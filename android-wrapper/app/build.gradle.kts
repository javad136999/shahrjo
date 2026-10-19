plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val releaseStoreFile = providers.environmentVariable("SHAHRJO_KEYSTORE_PATH").orNull
val releaseStorePassword = providers.environmentVariable("SHAHRJO_KEYSTORE_PASSWORD").orNull
val releaseKeyAlias = providers.environmentVariable("SHAHRJO_KEY_ALIAS").orNull
val releaseKeyPassword = providers.environmentVariable("SHAHRJO_KEY_PASSWORD").orNull
val releaseSigningAvailable = listOf(releaseStoreFile, releaseStorePassword, releaseKeyAlias, releaseKeyPassword).all { !it.isNullOrBlank() }

android {
    namespace = "ir.shahrju.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "ir.shahrju.app"
        minSdk = 23
        targetSdk = 35
        versionCode = 2
        versionName = "1.1.0"
        buildConfigField("String", "BAZAAR_RSA_PUBLIC_KEY", "\"MIHNMA0GCSqGSIb3DQEBAQUAA4G7ADCBtwKBrwDiXzQKwr+2XbCbF0gpOjDaHoZTGYuP6TU6nOBwfZfLMDnIPu3pwCTBwz2qRGWu8KybtqkQqdX3zGUSNk6IoTdhHzZuf+FLNNiR466CS1rTluQKJtIF1vh65DLBB7xO72xVG7PAIhfHjw1hqB2QrPV8Esjd7YHqU3ft4qWc0tm3HH80bgKI8Iq1aKKZQOPmw/gQBiWRqC44RarPefXdo4+J41t0y2IzO45IFM6lnPUCAwEAAQ==\"")
    }

    signingConfigs {
        if (releaseSigningAvailable) {
            create("release") {
                storeFile = file(releaseStoreFile!!)
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        getByName("debug")
        getByName("release") {
            isMinifyEnabled = false
            if (releaseSigningAvailable) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.github.cafebazaar.Poolakey:poolakey:2.2.0")
}
