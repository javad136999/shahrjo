package ir.shahrju.app

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import ir.cafebazaar.poolakey.Connection
import ir.cafebazaar.poolakey.ConnectionState
import ir.cafebazaar.poolakey.Payment
import ir.cafebazaar.poolakey.config.PaymentConfiguration
import ir.cafebazaar.poolakey.config.SecurityCheck
import ir.cafebazaar.poolakey.request.PurchaseRequest
import org.json.JSONObject
import java.util.UUID

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private var payment: Payment? = null
    private var paymentConnection: Connection? = null
    private var paymentReady = false

    /** Pending <input type="file"> request; the WebView is the one that posts it. */
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserLauncher: ActivityResultLauncher<Intent> =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = fileChooserCallback
            fileChooserCallback = null
            if (callback == null) return@registerForActivityResult
            if (result.resultCode != Activity.RESULT_OK) {
                callback.onReceiveValue(null)
                return@registerForActivityResult
            }
            val data = result.data
            val clip = data?.clipData
            val uris: Array<Uri>? = when {
                clip != null -> Array(clip.itemCount) { index -> clip.getItemAt(index).uri }
                data?.data != null -> arrayOf(data.data!!)
                else -> null
            }
            callback.onReceiveValue(uris)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)

        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
        }
        // Let Android place the WebView between the system bars. The web app
        // already handles its own safe-area CSS; applying navigation-bar
        // padding here as well pushed its fixed bottom navigation upward.
        WindowCompat.setDecorFitsSystemWindows(window, true)
        window.statusBarColor = Color.rgb(11, 128, 100)
        WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = false
        WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightNavigationBars = true
        val root = FrameLayout(this)
        // Small, deliberate visual breathing room: lower the top header a
        // little and lift the fixed bottom navigation without reintroducing
        // the large system-bar inset that previously moved it too far up.
        val chromeSpacing = (6 * resources.displayMetrics.density).toInt()
        root.setPadding(0, chromeSpacing, 0, chromeSpacing)
        root.addView(webView)
        setContentView(root)
        configureFileChooser()
        installSecureWebBridge()
        configureWebNavigation()
        initializePoolakey()

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(HOME_URL)
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    /**
     * Without a WebChromeClient the WebView silently ignores every
     * `<input type="file">` tap, so the owner could never pick a business photo
     * inside the installed app. This opens the system document picker and hands
     * the chosen image back to the page.
     */
    private fun configureFileChooser() {
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: WebChromeClient.FileChooserParams?,
            ): Boolean {
                // A second request while one is open would leak the first callback.
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = filePathCallback
                val intent = runCatching { fileChooserParams?.createIntent() }.getOrNull()
                    ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = "image/*"
                    }
                return runCatching {
                    fileChooserLauncher.launch(intent)
                    true
                }.getOrElse {
                    fileChooserCallback = null
                    false
                }
            }
        }
    }

    private fun configureWebNavigation() {
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (isTrustedOrigin(uri)) return false

                if (uri.scheme == "https" || uri.scheme == "tel" || uri.scheme == "mailto") {
                    runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                    return true
                }
                return true
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                if (paymentReady && isTrustedOrigin(Uri.parse(url))) exposePaymentBridge()
            }
        }
    }

    private fun installSecureWebBridge() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            Toast.makeText(this, "نسخهٔ WebView دستگاه برای پرداخت بازار قدیمی است.", Toast.LENGTH_LONG).show()
            return
        }

        WebViewCompat.addWebMessageListener(
            webView,
            NATIVE_MESSAGE_OBJECT,
            TRUSTED_ORIGINS,
        ) { _, message: WebMessageCompat, sourceOrigin: Uri, isMainFrame: Boolean, replyProxy: JavaScriptReplyProxy ->
            if (!isMainFrame || !isTrustedOrigin(sourceOrigin)) return@addWebMessageListener
            handleBridgeMessage(message.data.orEmpty(), replyProxy)
        }
    }

    private fun initializePoolakey() {
        val rsaPublicKey = BuildConfig.BAZAAR_RSA_PUBLIC_KEY.trim()
        if (rsaPublicKey.isEmpty()) {
            Toast.makeText(this, "کلید عمومی بازار هنوز برای ساخت این نسخه تنظیم نشده است.", Toast.LENGTH_LONG).show()
            return
        }

        runCatching {
            val client = Payment(
                context = this,
                config = PaymentConfiguration(
                    localSecurityCheck = SecurityCheck.Enable(rsaPublicKey = rsaPublicKey),
                ),
            )
            payment = client
            paymentConnection = client.connect {
                connectionSucceed {
                    runOnUiThread {
                        paymentReady = true
                        exposePaymentBridge()
                    }
                }
                connectionFailed {
                    runOnUiThread {
                        paymentReady = false
                        removePaymentBridge()
                        Toast.makeText(this@MainActivity, "اتصال به پرداخت بازار برقرار نشد.", Toast.LENGTH_LONG).show()
                    }
                }
                disconnected {
                    runOnUiThread {
                        paymentReady = false
                        removePaymentBridge()
                    }
                }
            }
        }.onFailure {
            paymentReady = false
            removePaymentBridge()
            Toast.makeText(this, "راه‌اندازی پرداخت بازار ناموفق بود.", Toast.LENGTH_LONG).show()
        }
    }

    private fun exposePaymentBridge() {
        if (!::webView.isInitialized || !paymentReady) return
        webView.evaluateJavascript(BRIDGE_BOOTSTRAP, null)
    }

    private fun removePaymentBridge() {
        if (!::webView.isInitialized) return
        webView.evaluateJavascript("window.ShahrjoBazaar = undefined;", null)
    }

    private fun handleBridgeMessage(rawMessage: String, replyProxy: JavaScriptReplyProxy) {
        val message = runCatching { JSONObject(rawMessage) }.getOrNull() ?: return
        val requestId = message.optString("id")
        if (requestId.isBlank()) return

        when (message.optString("method")) {
            "purchase" -> startPurchase(
                requestId = requestId,
                productId = message.optString("productId"),
                requestedPackageName = message.optString("packageName"),
                replyProxy = replyProxy,
            )
            "consume" -> consumePurchase(
                requestId = requestId,
                purchaseToken = message.optString("purchaseToken"),
                replyProxy = replyProxy,
            )
            else -> sendError(replyProxy, requestId, "درخواست پرداخت نامعتبر است.")
        }
    }

    private fun startPurchase(
        requestId: String,
        productId: String,
        requestedPackageName: String,
        replyProxy: JavaScriptReplyProxy,
    ) {
        val client = payment
        val connection = paymentConnection
        if (!paymentReady || client == null || connection?.getState() != ConnectionState.Connected) {
            sendError(replyProxy, requestId, "اتصال بازار آماده نیست؛ بازار را نصب و دوباره تلاش کنید.")
            return
        }
        if (requestedPackageName != BuildConfig.BAZAAR_PACKAGE_NAME || requestedPackageName != packageName) {
            sendError(replyProxy, requestId, "شناسهٔ برنامه با تنظیمات بازار یکسان نیست.")
            return
        }
        if (productId !in SUPPORTED_PRODUCT_IDS) {
            sendError(replyProxy, requestId, "شناسهٔ پلن اشتراک معتبر نیست.")
            return
        }

        runCatching {
            client.purchaseProduct(
                registry = activityResultRegistry,
                request = PurchaseRequest(
                    productId = productId,
                    payload = "shahrjo:${UUID.randomUUID()}",
                ),
            ) {
                purchaseSucceed { purchase ->
                    sendSuccess(
                        replyProxy,
                        requestId,
                        JSONObject()
                            .put("purchaseToken", purchase.purchaseToken)
                            .put("productId", productId),
                    )
                }
                purchaseCanceled {
                    sendError(replyProxy, requestId, "پرداخت توسط شما لغو شد.")
                }
                purchaseFailed { throwable ->
                    sendError(replyProxy, requestId, safeError("خرید از بازار ناموفق بود.", throwable))
                }
                failedToBeginFlow { throwable ->
                    sendError(replyProxy, requestId, safeError("صفحهٔ پرداخت بازار باز نشد.", throwable))
                }
            }
        }.onFailure {
            sendError(replyProxy, requestId, safeError("شروع پرداخت بازار ناموفق بود.", it))
        }
    }

    private fun consumePurchase(
        requestId: String,
        purchaseToken: String,
        replyProxy: JavaScriptReplyProxy,
    ) {
        val client = payment
        if (!paymentReady || client == null || purchaseToken.isBlank()) {
            sendError(replyProxy, requestId, "تأیید نهایی خرید بازار ممکن نشد.")
            return
        }

        runCatching {
            client.consumeProduct(purchaseToken = purchaseToken) {
                consumeSucceed {
                    sendSuccess(replyProxy, requestId, JSONObject())
                }
                consumeFailed { throwable ->
                    sendError(replyProxy, requestId, safeError("نهایی‌سازی خرید در بازار ناموفق بود.", throwable))
                }
            }
        }.onFailure {
            sendError(replyProxy, requestId, safeError("نهایی‌سازی خرید در بازار ناموفق بود.", it))
        }
    }

    private fun sendSuccess(replyProxy: JavaScriptReplyProxy, requestId: String, value: JSONObject) {
        if (isFinishing || isDestroyed) return
        runOnUiThread {
            replyProxy.postMessage(
                JSONObject()
                    .put("id", requestId)
                    .put("ok", true)
                    .put("value", value)
                    .toString(),
            )
        }
    }

    private fun sendError(replyProxy: JavaScriptReplyProxy, requestId: String, error: String) {
        if (isFinishing || isDestroyed) return
        runOnUiThread {
            replyProxy.postMessage(
                JSONObject()
                    .put("id", requestId)
                    .put("ok", false)
                    .put("error", error)
                    .toString(),
            )
        }
    }

    private fun safeError(defaultMessage: String, throwable: Throwable): String =
        throwable.message?.takeIf { it.isNotBlank() }?.let { "$defaultMessage ($it)" } ?: defaultMessage

    private fun isTrustedOrigin(uri: Uri): Boolean =
        uri.scheme == "https" && uri.host in TRUSTED_HOSTS

    override fun onSaveInstanceState(outState: Bundle) {
        if (::webView.isInitialized) webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        fileChooserCallback?.onReceiveValue(null)
        fileChooserCallback = null
        paymentConnection?.disconnect()
        paymentConnection = null
        payment = null
        if (::webView.isInitialized) {
            (webView.parent as? ViewGroup)?.removeView(webView)
            webView.stopLoading()
            webView.destroy()
        }
        super.onDestroy()
    }

    private companion object {
        const val HOME_URL = "https://shahrju.ir/"

        const val NATIVE_MESSAGE_OBJECT = "ShahrjoBazaarNative"
        val TRUSTED_HOSTS = setOf("shahrju.ir", "www.shahrju.ir")
        val TRUSTED_ORIGINS = setOf("https://shahrju.ir", "https://www.shahrju.ir")
        val SUPPORTED_PRODUCT_IDS = setOf(
            "GOLD_1M",
            "GOLD_6M",
            "GOLD_12M",
            "SILVER_1M",
            "SILVER_6M",
            "SILVER_12M",
        )

        val BRIDGE_BOOTSTRAP = """
            (function () {
              const native = window.ShahrjoBazaarNative;
              if (!native) return;
              const pending = window.__shahrjoBazaarPending || (window.__shahrjoBazaarPending = new Map());
              if (typeof window.__shahrjoBazaarRequestNumber !== 'number') window.__shahrjoBazaarRequestNumber = 0;
              native.onmessage = function (event) {
                let message;
                try { message = JSON.parse(event.data); } catch (_) { return; }
                const request = pending.get(message.id);
                if (!request) return;
                pending.delete(message.id);
                if (message.ok) request.resolve(message.value);
                else request.reject(new Error(message.error || 'عملیات پرداخت ناموفق بود.'));
              };
              function call(method, parameters) {
                return new Promise(function (resolve, reject) {
                  const id = String(Date.now()) + '-' + (++window.__shahrjoBazaarRequestNumber);
                  pending.set(id, { resolve: resolve, reject: reject });
                  native.postMessage(JSON.stringify(Object.assign({ id: id, method: method }, parameters)));
                });
              }
              window.ShahrjoBazaar = Object.freeze({
                purchase: function (input) {
                  return call('purchase', { productId: input.productId, packageName: input.packageName });
                },
                consume: function (input) {
                  return call('consume', { purchaseToken: input.purchaseToken });
                }
              });
            })();
        """.trimIndent()
    }
}
