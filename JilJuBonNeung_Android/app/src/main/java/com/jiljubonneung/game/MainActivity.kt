package com.jiljubonneung.game

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
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
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import java.io.PrintWriter
import java.io.StringWriter

/**
 * 질주 본능 — 안드로이드 WebView 래퍼.
 * assets/index.html 을 file:// 로 직접 로드.
 *
 * 풀스크린 처리는 setContentView 이후에 [WindowCompat]로 안전하게 적용한다.
 * (이전: window.insetsController 가 setContentView 전에는 null 인 기기/안드로이드 조합에서 NPE)
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
            applyImmersiveMode()
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

    /** WindowCompat로 풀스크린/시스템 바 숨김 — DecorView 가 준비된 뒤(=setContentView 이후) 호출. */
    private fun applyImmersiveMode() {
        try {
            WindowCompat.setDecorFitsSystemWindows(window, false)
            val controller = WindowCompat.getInsetsController(window, window.decorView)
            controller.hide(WindowInsetsCompat.Type.statusBars() or WindowInsetsCompat.Type.navigationBars())
            controller.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        } catch (t: Throwable) {
            // 풀스크린 처리는 보조 기능 — 실패해도 게임 자체는 동작해야 함
            Log.w(TAG, "applyImmersiveMode failed: ${t.message}")
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
            addView(
                txt,
                ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ),
            )
        }
        setContentView(scroll)
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
