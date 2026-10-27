// A fresh, single-use Turnstile token is needed for each network retry.
let loading;
export function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading)
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.onload = () =>
        window.turnstile
          ? resolve(window.turnstile)
          : reject(Error("challenge"));
      script.onerror = () => {
        script.remove();
        reject(Error("challenge"));
      };
      document.head.append(script);
    }).catch((error) => {
      loading = undefined;
      throw error;
    });
  return loading;
}
export async function mountChallenge(
  target,
  config,
  { success, failure, expired = failure },
) {
  const api = await loadTurnstile();
  if (!target.isConnected) return () => {};
  const id = api.render(target, {
    sitekey: config.turnstileSiteKey,
    action: "mock-exam-submit",
    callback: success,
    "error-callback": () => {
      failure();
      return true;
    },
    "expired-callback": expired,
    "timeout-callback": failure,
  });
  let disposed = false;
  return () => {
    if (!disposed) {
      disposed = true;
      api.remove(id);
    }
  };
}
