// Push notification management for Titus Messenger
const PushNotifications = (function() {
  'use strict';

  let vapidKey = null;

  function getToken() {
    return localStorage.getItem('titus_token') || '';
  }

  async function init() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[Push] Not supported in this browser');
      return false;
    }

    try {
      var res = await fetch('/api/chat/push/vapid-key', {
        headers: { 'Authorization': 'Bearer ' + getToken() }
      });
      if (!res.ok) {
        console.log('[Push] VAPID key endpoint returned', res.status);
        return false;
      }
      var data = await res.json();
      vapidKey = data.vapidPublicKey || data.publicKey || null;
      return !!vapidKey;
    } catch (e) {
      console.error('[Push] Init error:', e);
      return false;
    }
  }

  async function subscribe() {
    if (!vapidKey) return null;

    try {
      var reg = await navigator.serviceWorker.ready;

      // Check for existing subscription
      var existing = await reg.pushManager.getSubscription();
      if (existing) {
        // Re-send to server in case it was lost
        await sendSubscription(existing);
        return existing;
      }

      // Create new subscription
      var subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });

      await sendSubscription(subscription);
      return subscription;
    } catch (e) {
      if (Notification.permission === 'denied') {
        console.log('[Push] Notifications denied by user');
      } else {
        console.error('[Push] Subscribe error:', e);
      }
      return null;
    }
  }

  async function unsubscribe() {
    try {
      var reg = await navigator.serviceWorker.ready;
      var subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/chat/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + getToken()
          },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        await subscription.unsubscribe();
      }
    } catch (e) {
      console.error('[Push] Unsubscribe error:', e);
    }
  }

  async function sendSubscription(subscription) {
    try {
      await fetch('/api/chat/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getToken()
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          device_info: navigator.userAgent.substring(0, 120)
        })
      });
    } catch (e) {
      console.error('[Push] Send subscription error:', e);
    }
  }

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  return { init: init, subscribe: subscribe, unsubscribe: unsubscribe };
})();
