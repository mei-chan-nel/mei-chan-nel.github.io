document.addEventListener("click", (event) => {
  const button = event.target.closest(".video-trigger");
  if (!button) return;

  const videoId = button.dataset.videoId;
  const targetId = button.getAttribute("aria-controls");
  const target = targetId ? document.getElementById(targetId) : null;
  if (!videoId || !target) return;

  if (target.dataset.loaded === "true") {
    const expanded = button.getAttribute("aria-expanded") === "true";
    target.hidden = expanded;
    button.setAttribute("aria-expanded", String(!expanded));
    button.textContent = expanded ? "解説動画を表示" : "解説動画を閉じる";
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`;
  iframe.title = button.dataset.videoTitle || "解説動画";
  iframe.loading = "lazy";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.allowFullscreen = true;

  target.replaceChildren(iframe);
  target.dataset.loaded = "true";
  target.hidden = false;
  button.textContent = "解説動画を閉じる";
  button.setAttribute("aria-expanded", "true");

});
