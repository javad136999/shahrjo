package ir.shahrju.app

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import ir.cafebazaar.poolakey.Payment
import ir.cafebazaar.poolakey.PaymentConfiguration
import ir.cafebazaar.poolakey.SecurityCheck
import ir.cafebazaar.poolakey.request.PurchaseRequest
import org.json.JSONObject

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var payment: Payment
    private var billingConnected = false
    private val allowedProducts = setOf(
        "SILVER_1M", "SILVER_6M", "SILVER_12M",
        "GOLD_1M", "GOLD_6M", "GOLD_12M"
    )

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        payment = Payment(
            context = this,
            config = PaymentConfiguration(
                localSecurityCheck = SecurityCheck.Enable(rsaPublicKey = BuildConfig.BAZAAR_RSA_PUBLIC_KEY),
                shouldSupportSubscription = true
            )
        )
        payment.connect {
            connectionSucceed { runOnUiThread { billingConnected = true } }
            connectionFailed { error ->
                runOnUiThread {
                    billingConnected = false
                    Toast.makeText(this@MainActivity, "اتصال پرداخت بازار برقرار نشد: ${error.message ?: ""}", Toast.LENGTH_LONG).show()
                }
            }
            disconnected { runOnUiThread { billingConnected = false } }
        }

        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
            }
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                return !url.startsWith("https://shahrju.ir") && !url.startsWith("https://www.shahrju.ir")
            }
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                if (url.startsWith("https://shahrju.ir") || url.startsWith("https://www.shahrju.ir")) {
                    injectBazaarBridge()
                }
            }
        }
        webView.addJavascriptInterface(NativeBazaarBridge(), "ShahrjoNative")
        setContentView(webView)
        if (savedInstanceState == null) webView.loadUrl("https://shahrju.ir")
        else webView.restoreState(savedInstanceState)
    }

    private fun injectBazaarBridge() {
        val js = """
            (function() {
              if (window.ShahrjoBazaar && window.ShahrjoBazaar.__nativeReady) return;
              const pending = new Map();
              window.ShahrjoBazaar = {
                __nativeReady: true,
                purchase: function(input) {
                  return new Promise(function(resolve, reject) {
                    const id = String(Date.now()) + "-" + Math.random().toString(36).slice(2);
                    pending.set(id, {resolve: resolve, reject: reject});
                    window.ShahrjoNative.purchase(String(input.productId || ""), String(input.packageName || ""), id);
                  });
                },
                _resolve: function(id, raw) {
                  const item = pending.get(id);
                  if (!item) return;
                  pending.delete(id);
                  try {
                    const result = JSON.parse(raw);
                    if (result.error) item.reject(new Error(result.error));
                    else item.resolve(result);
                  } catch (e) { item.reject(new Error("پاسخ پرداخت بازار نامعتبر است")); }
                }
              };
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    inner class NativeBazaarBridge {
        @JavascriptInterface
        fun purchase(productId: String, packageName: String, callbackId: String) {
            if (packageName != "ir.shahrju.app") {
                sendResult(callbackId, error = "شناسه برنامه با شهرجو مطابقت ندارد")
                return
            }
            if (productId !in allowedProducts) {
                sendResult(callbackId, error = "شناسه اشتراک معتبر نیست")
                return
            }
            runOnUiThread {
                if (!billingConnected) {
                    sendResult(callbackId, error = "اتصال بازار آماده نیست؛ چند لحظه بعد دوباره تلاش کنید")
                    return@runOnUiThread
                }
                val request = PurchaseRequest(
                    productId = productId,
                    payload = "shahrjo",
                    dynamicPriceToken = null
                )
                payment.subscribeProduct(
                    registry = activityResultRegistry,
                    request = request
                ) {
                    purchaseSucceed { info ->
                        sendResult(callbackId, result = mapOf(
                            "purchaseToken" to info.purchaseToken,
                            "productId" to info.productId
                        ))
                    }
                    purchaseCanceled {
                        sendResult(callbackId, error = "خرید توسط کاربر لغو شد")
                    }
                    purchaseFailed { error ->
                        sendResult(callbackId, error = "خرید بازار ناموفق بود: ${error.message ?: ""}")
                    }
                    failedToBeginFlow { error ->
                        sendResult(callbackId, error = "شروع پرداخت بازار ممکن نشد: ${error.message ?: ""}")
                    }
                }
            }
        }
    }

    private fun sendResult(callbackId: String, result: Map<String, String>? = null, error: String? = null) {
        val payload = if (error != null) JSONObject(mapOf("error" to error)).toString()
        else JSONObject(result ?: emptyMap<String, String>()).toString()
        runOnUiThread {
            webView.evaluateJavascript(
                "window.ShahrjoBazaar && window.ShahrjoBazaar._resolve(${JSONObject.quote(callbackId)}, ${JSONObject.quote(payload)});",
                null
            )
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.removeJavascriptInterface("ShahrjoNative")
            webView.destroy()
        }
        super.onDestroy()
    }
}
