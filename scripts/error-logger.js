/**
 * Auto Error Detection & Self-Healing System
 *
 * Monitors production errors in real-time:
 * - JavaScript errors
 * - Promise rejections
 * - Network failures
 * - Runtime exceptions
 *
 * Automatically reports errors to the backend API which creates
 * GitHub issues for AI-powered analysis and fix proposals.
 */
(function () {
  'use strict';

  const CONFIG = {
    apiEndpoint: '/api/report-error',
    maxErrorsPerMinute: 10,
    batchInterval: 5000,
    enableConsoleCapture: true,
    enableNetworkCapture: true,
    ignoredErrors: [
      'ResizeObserver loop limit exceeded',
      'Script error.',
      'Non-Error promise rejection captured',
    ],
    ignoredUrls: [
      'extensions://',
      'chrome-extension://',
      'moz-extension://',
    ],
  };

  let errorQueue = [];
  let errorCount = 0;
  let lastErrorReset = Date.now();
  let batchTimer = null;
  let sessionId = generateSessionId();

  function generateSessionId() {
    return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
  }

  function getEnvironmentInfo() {
    return {
      url: window.location.href,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenSize: window.screen.width + 'x' + window.screen.height,
      viewportSize: window.innerWidth + 'x' + window.innerHeight,
      timestamp: new Date().toISOString(),
      sessionId: sessionId,
      referrer: document.referrer || 'direct',
    };
  }

  function isIgnoredError(message, source) {
    if (!message) return true;
    var msgStr = String(message);
    for (var i = 0; i < CONFIG.ignoredErrors.length; i++) {
      if (msgStr.indexOf(CONFIG.ignoredErrors[i]) !== -1) return true;
    }
    if (source) {
      for (var j = 0; j < CONFIG.ignoredUrls.length; j++) {
        if (source.indexOf(CONFIG.ignoredUrls[j]) !== -1) return true;
      }
    }
    return false;
  }

  function isRateLimited() {
    var now = Date.now();
    if (now - lastErrorReset > 60000) {
      errorCount = 0;
      lastErrorReset = now;
    }
    errorCount++;
    return errorCount > CONFIG.maxErrorsPerMinute;
  }

  function captureError(errorData) {
    if (isRateLimited()) return;
    errorQueue.push(errorData);
    scheduleBatchSend();
  }

  function scheduleBatchSend() {
    if (batchTimer) return;
    batchTimer = setTimeout(function () {
      flushErrors();
      batchTimer = null;
    }, CONFIG.batchInterval);
  }

  function flushErrors() {
    if (errorQueue.length === 0) return;
    var errors = errorQueue.splice(0, errorQueue.length);
    var payload = {
      errors: errors,
      environment: getEnvironmentInfo(),
      errorCount: errors.length,
    };
    sendToApi(payload);
  }

  function sendToApi(payload) {
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        navigator.sendBeacon(CONFIG.apiEndpoint, blob);
      } else {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', CONFIG.apiEndpoint, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(payload));
      }
    } catch (e) {
      // Fail silently to avoid error loops
    }
  }

  function formatStackTrace(error) {
    if (!error) return '';
    if (error.stack) return error.stack;
    return String(error);
  }

  // Global error handler - catches JavaScript errors
  window.addEventListener('error', function (event) {
    if (isIgnoredError(event.message, event.filename)) return;
    captureError({
      type: 'javascript_error',
      message: event.message,
      source: event.filename || 'unknown',
      line: event.lineno,
      column: event.colno,
      stack: event.error ? formatStackTrace(event.error) : '',
      severity: 'error',
      timestamp: new Date().toISOString(),
    });
  });

  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', function (event) {
    var message = '';
    var stack = '';
    if (event.reason) {
      if (event.reason instanceof Error) {
        message = event.reason.message;
        stack = formatStackTrace(event.reason);
      } else if (typeof event.reason === 'string') {
        message = event.reason;
      } else {
        try { message = JSON.stringify(event.reason); } catch (e) { message = String(event.reason); }
      }
    }
    if (isIgnoredError(message)) return;
    captureError({
      type: 'unhandled_rejection',
      message: message,
      stack: stack,
      severity: 'error',
      timestamp: new Date().toISOString(),
    });
  });

  // Network error monitoring - intercept fetch
  if (CONFIG.enableNetworkCapture && window.fetch) {
    var originalFetch = window.fetch;
    window.fetch = function () {
      var url = arguments[0];
      if (typeof url === 'object' && url.url) url = url.url;
      var urlStr = String(url);

      // Don't intercept our own error reporting calls
      if (urlStr.indexOf(CONFIG.apiEndpoint) !== -1) {
        return originalFetch.apply(this, arguments);
      }

      return originalFetch.apply(this, arguments).then(function (response) {
        if (!response.ok && response.status >= 500) {
          captureError({
            type: 'network_error',
            message: 'HTTP ' + response.status + ' ' + response.statusText,
            source: urlStr,
            severity: response.status >= 500 ? 'error' : 'warning',
            metadata: {
              status: response.status,
              statusText: response.statusText,
              method: (arguments[1] && arguments[1].method) || 'GET',
            },
            timestamp: new Date().toISOString(),
          });
        }
        return response;
      }).catch(function (error) {
        captureError({
          type: 'network_error',
          message: 'Fetch failed: ' + (error.message || String(error)),
          source: urlStr,
          stack: formatStackTrace(error),
          severity: 'error',
          timestamp: new Date().toISOString(),
        });
        throw error;
      });
    };
  }

  // Network error monitoring - intercept XMLHttpRequest
  if (CONFIG.enableNetworkCapture) {
    var originalXhrOpen = XMLHttpRequest.prototype.open;
    var originalXhrSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this._errorLoggerUrl = url;
      this._errorLoggerMethod = method;
      return originalXhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      var self = this;
      var url = self._errorLoggerUrl;

      // Don't intercept our own error reporting
      if (url && String(url).indexOf(CONFIG.apiEndpoint) !== -1) {
        return originalXhrSend.apply(this, arguments);
      }

      self.addEventListener('error', function () {
        captureError({
          type: 'network_error',
          message: 'XHR request failed',
          source: url,
          severity: 'error',
          metadata: { method: self._errorLoggerMethod },
          timestamp: new Date().toISOString(),
        });
      });

      self.addEventListener('load', function () {
        if (self.status >= 500) {
          captureError({
            type: 'network_error',
            message: 'XHR HTTP ' + self.status,
            source: url,
            severity: 'error',
            metadata: { method: self._errorLoggerMethod, status: self.status },
            timestamp: new Date().toISOString(),
          });
        }
      });

      return originalXhrSend.apply(this, arguments);
    };
  }

  // Console error capture
  if (CONFIG.enableConsoleCapture && window.console) {
    var originalConsoleError = console.error;
    console.error = function () {
      var args = Array.prototype.slice.call(arguments);
      var message = args.map(function (arg) {
        if (arg instanceof Error) return arg.message;
        if (typeof arg === 'object') {
          try { return JSON.stringify(arg); } catch (e) { return String(arg); }
        }
        return String(arg);
      }).join(' ');

      if (!isIgnoredError(message)) {
        captureError({
          type: 'console_error',
          message: message,
          severity: 'error',
          timestamp: new Date().toISOString(),
        });
      }
      return originalConsoleError.apply(console, arguments);
    };
  }

  // Flush errors before page unload
  window.addEventListener('beforeunload', function () {
    flushErrors();
  });

  // Expose configuration API
  window.ErrorLogger = {
    configure: function (options) {
      for (var key in options) {
        if (options.hasOwnProperty(key) && CONFIG.hasOwnProperty(key)) {
          CONFIG[key] = options[key];
        }
      }
    },
    captureError: function (message, metadata) {
      captureError({
        type: 'manual',
        message: message,
        severity: 'error',
        metadata: metadata || {},
        timestamp: new Date().toISOString(),
      });
    },
    captureWarning: function (message, metadata) {
      captureError({
        type: 'manual',
        message: message,
        severity: 'warning',
        metadata: metadata || {},
        timestamp: new Date().toISOString(),
      });
    },
    flush: flushErrors,
    getSessionId: function () { return sessionId; },
  };
})();
