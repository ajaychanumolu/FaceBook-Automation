/**
 * Render Free Tier Keep-Alive Worker
 * Pings the server's public endpoint every 10 minutes to prevent Render free-tier spin-down (inactivity timeout is 15 minutes).
 * Can be imported into server.js or run standalone via `npm run keepalive` / `node services/keepAlive.js`.
 */

let keepAliveTimer = null;

/**
 * Resolve the target public URL to ping.
 * Supports RENDER_EXTERNAL_URL (Render environment), BASE_URL, or falls back to production domain.
 */
function getTargetUrl() {
  const rawUrl = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL;
  if (!rawUrl) {
    return 'https://facebook.oneinfo.ai';
  }
  // Sanitize common typo and strip trailing slashes
  return rawUrl.replace(/oneingo\.ai/gi, 'oneinfo.ai').replace(/\/$/, '');
}

/**
 * Start the keep-alive background worker.
 * @param {Object} [options]
 * @param {number} [options.intervalMinutes=10]
 * @param {string} [options.targetUrl]
 */
function startKeepAlive(options = {}) {
  const intervalMinutes = options.intervalMinutes || 10;
  const baseUrl = options.targetUrl || getTargetUrl();

  // If explicitly developing on localhost, do not self-ping over the internet unless forced
  if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
    console.log('[Keep-Alive] Local development environment detected; external keep-alive ping disabled.');
    return null;
  }

  const pingUrl = `${baseUrl}/health`;
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[Keep-Alive] 🚀 Keep-alive worker started:`);
  console.log(`[Keep-Alive]    Target:   ${pingUrl}`);
  console.log(`[Keep-Alive]    Interval: Every ${intervalMinutes} minutes (Render sleeps after 15m)`);

  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
  }

  const doPing = async () => {
    try {
      const res = await fetch(pingUrl, {
        headers: { 'User-Agent': 'RenderKeepAliveWorker/1.0' }
      });
      if (res.ok) {
        console.log(`[Keep-Alive] ✅ Ping successful (${res.status} OK) at ${new Date().toLocaleTimeString()}`);
      } else {
        console.warn(`[Keep-Alive] ⚠️ Ping returned status ${res.status}`);
      }
    } catch (err) {
      console.warn(`[Keep-Alive] Notice: Ping attempt failed (${err.message})`);
    }
  };

  // Run initial warm-up ping 15 seconds after server startup
  setTimeout(doPing, 15000);

  // Repeat every 10 minutes
  keepAliveTimer = setInterval(doPing, intervalMs);

  return keepAliveTimer;
}

/**
 * Stop the keep-alive background worker.
 */
function stopKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
    console.log('[Keep-Alive] Keep-alive worker stopped.');
  }
}

// Allow standalone execution: `node services/keepAlive.js`
if (require.main === module) {
  require('dotenv').config();
  console.log('[Keep-Alive] Running in standalone script mode...');
  startKeepAlive();
}

module.exports = {
  startKeepAlive,
  stopKeepAlive,
  getTargetUrl
};
