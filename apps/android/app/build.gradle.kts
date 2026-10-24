plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val bazaarRsaPublicKey = providers.gradleProperty("BAZAAR_RSA_PUBLIC_KEY").orElse("").get()
val escapedRsaPublicKey = bazaarRsaPublicKey
    .replace("\\", "\\\\")
    .replace("\"", "\\\"")

android {
    namespace = "ir.shahrju.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "ir.shahrju.app"
        minSdk = 21
        targetSdk = 35
        versionCode = 5
        versionName = "1.0.4"
        buildConfigField("String", "BAZAAR_PACKAGE_NAME", "\"ir.shahrju.app\"")
        buildConfigField("String", "BAZAAR_RSA_PUBLIC_KEY", "\"$escapedRsaPublicKey\"")
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.13.0")
    implementation("com.github.cafebazaar.Poolakey:poolakey:2.3.0")
}

val verifyBazaarReleaseKey = tasks.register("verifyBazaarReleaseKey") {
    doLast {
        check(bazaarRsaPublicKey.isNotBlank()) {
            "BAZAAR_RSA_PUBLIC_KEY is required for a release build. Set it in ~/.gradle/gradle.properties (outside Git)."
        }
    }
}

tasks.configureEach {
    if (name == "assembleRelease" || name == "bundleRelease") {
        dependsOn(verifyBazaarReleaseKey)
    }
}
