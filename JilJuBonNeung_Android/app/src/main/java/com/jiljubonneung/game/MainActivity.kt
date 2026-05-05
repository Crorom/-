package com.jiljubonneung.game

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import java.io.PrintWriter
import java.io.StringWriter

/**
 * 질주 본능 — 안드로이드 WebView 래퍼.
 * 단순화된 구현: assets/index.html 을 file:// 로 직접 로드.
 */
class MainActivity : AppCompatActivity() {

    private var webView: WebView? = null

    companion object {
        private const val TAG = "JilJuWebView"
        private const val START_URL = "file:///android_asset/index.html"
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        try {
            applyImmersiveMode()

            val wv = WebView(this)
            wv.settings.apply {
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
                allowFileAccessFromFileURLs = true
                allowUniversalAccessFromFileURLs = true

                cacheMode = WebSettings.LOAD_DEFAULT
                mediaPlaybackRequiresUserGesture = false

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                }
            }

            wv.webViewClient = object : WebViewClient() {
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

            wv.isVerticalScrollBarEnabled = false
            wv.isHorizontalScrollBarEnabled = false
            wv.overScrollMode = View.OVER_SCROLL_NEVER
            wv.setOnLongClickListener { true }
            wv.isLongClickable = false

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
            showFallback(t)
        }
    }

    private fun showFallback(t: Throwable) {
        val sw = StringWriter()
        t.printStackTrace(PrintWriter(sw))
        val full = sw.toString()

        val txt = TextView(this).apply {
            setBackgroundColor(0xFF000000.toInt())
            setTextColor(0xFFFFFFFF.toInt())
            setPadding(40, 60, 40, 40)
            textSize = 12f
            gravity = Gravity.TOP
            text = buildString {
                appendLine("화면을 띄울 수 없습니다.")
                appendLine()
                appendLine("Android System WebView 또는 Chrome을")
                appendLine("Play 스토어에서 최신으로 업데이트한 뒤")
                appendLine("다시 실행해 주세요.")
                appendLine()
                appendLine("--- DEBUG ---")
                appendLine("Build.VERSION=${Build.VERSION.SDK_INT}")
                appendLine("Build.MODEL=${Build.MANUFACTURER} ${Build.MODEL}")
                appendLine()
                append(full)
            }
        }
        val scroll = ScrollView(this).apply {
            setBackgroundColor(0xFF000000.toInt())
            addView(txt, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        }
        setContentView(scroll)
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
        super.onPause()
        webView?.onPause()
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
