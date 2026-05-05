package com.jiljubonneung.game

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

/**
 * 질주 본능 — 안드로이드 WebView 래퍼.
 * file:// 직접 로드는 기기/WebView 조합에 따라 즉시 종료·빈 화면이 날 수 있어,
 * [WebViewAssetLoader]로 assets를 가상 HTTPS URL로 제공합니다.
 */
class MainActivity : AppCompatActivity() {

    private var webView: WebView? = null

    companion object {
        private const val TAG = "JilJuWebView"

        /** "/assets/" 접두사 → APK의 assets/ 디렉터리 */
        private const val START_URL =
            "https://appassets.androidplatform.net/assets/index.html"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        try {
            applyImmersiveMode()

            val loader = WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
                .build()

            val wv = WebView(this).apply {
                settings.apply {
                    javaScriptEnabled = true
                    domStorageEnabled = true
                    useWideViewPort = true
                    loadWithOverviewMode = true

                    builtInZoomControls = false
                    displayZoomControls = false
                    setSupportZoom(false)
                    textZoom = 100

                    allowFileAccess = true
                    allowContentAccess = true

                    cacheMode = WebSettings.LOAD_DEFAULT
                    mediaPlaybackRequiresUserGesture = false

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                    }
                }

                webViewClient = object : WebViewClientCompat() {
                    override fun shouldInterceptRequest(
                        view: WebView,
                        request: WebResourceRequest,
                    ): WebResourceResponse? {
                        return loader.shouldInterceptRequest(request.url)
                    }

                    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                        super.onPageStarted(view, url, favicon)
                        Log.i(TAG, "onPageStarted: $url")
                    }

                    override fun onReceivedError(
                        view: WebView,
                        request: WebResourceRequest,
                        error: WebResourceError,
                    ) {
                        super.onReceivedError(view, request, error)
                        Log.e(
                            TAG,
                            "onReceivedError: ${error.description} url=${request.url} mainFrame=${request.isForMainFrame}",
                        )
                    }
                }

                isVerticalScrollBarEnabled = false
                isHorizontalScrollBarEnabled = false
                overScrollMode = View.OVER_SCROLL_NEVER
                setOnLongClickListener { true }
                isLongClickable = false
            }

            webView = wv
            setContentView(wv)
            wv.loadUrl(START_URL)

            onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    val v = webView
                    if (v != null && v.canGoBack()) {
                        v.goBack()
                    } else {
                        finish()
                    }
                }
            })
        } catch (t: Throwable) {
            Log.e(TAG, "WebView init failed", t)
            webView = null
            val msg = buildString {
                appendLine("화면을 띄울 수 없습니다.")
                appendLine()
                appendLine("Android System WebView 또는 Chrome을")
                appendLine("Play 스토어에서 최신으로 업데이트 해 주세요.")
                appendLine()
                append("(${t.javaClass.simpleName}: ${t.message})")
            }
            setContentView(
                TextView(this).apply {
                    text = msg
                    setPadding(48, 48, 48, 48)
                    textSize = 14f
                },
            )
        }
    }

    @Suppress("DEPRECATION")
    private fun applyImmersiveMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            window.insetsController?.let { controller ->
                controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                controller.systemBarsBehavior =
                    WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                )
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) applyImmersiveMode()
    }

    override fun onPause() {
        webView?.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView?.onResume()
    }

    override fun onDestroy() {
        webView?.let { v ->
            try {
                (v.parent as? ViewGroup)?.removeView(v)
                v.stopLoading()
                v.loadUrl("about:blank")
                v.destroy()
            } catch (e: Exception) {
                Log.w(TAG, "onDestroy webView: ${e.message}")
            }
        }
        webView = null
        super.onDestroy()
    }
}
