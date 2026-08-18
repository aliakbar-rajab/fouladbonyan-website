(() => {
  "use strict";

  const SESSION_KEY = "bonyan-foulad-daria-preloader-seen-v9";
  let finished = false;
  let watchdog = 0;
  let overlay = null;
  let site = null;
  let video = null;

  const storage = {
    get() {
      try {
        return window.sessionStorage.getItem(SESSION_KEY);
      } catch {
        return null;
      }
    },
    set() {
      try {
        window.sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        // Storage may be unavailable in privacy modes. Failing open is intentional.
      }
    },
  };

  function restoreSite() {
    document.body.classList.remove("fb-preloader-active");
    if (site) {
      site.removeAttribute("inert");
      site.removeAttribute("aria-hidden");
    }
  }

  function finish() {
    if (finished) return;
    finished = true;
    storage.set();
    window.clearTimeout(watchdog);
    restoreSite();

    if (!overlay) return;
    overlay.classList.add("is-leaving");
    window.setTimeout(() => overlay?.remove(), 260);
  }

  function skipPreloader() {
    storage.set();
  }

  function showPlaybackPrompt() {
    if (!overlay || finished) return;
    window.clearTimeout(watchdog);
    overlay.classList.add("needs-play");
    // If autoplay was blocked and the visitor never notices the manual
    // play button, the gate must not strand them on the overlay forever.
    watchdog = window.setTimeout(finish, 6000);
  }

  if (window.location.pathname !== "/") {
    // The brand intro has nothing to add on a page a visitor reached
    // looking for a specific price or document — skip it without
    // downloading the video, and without marking the session as seen so
    // a later visit to "/" itself still shows it once.
    return;
  }

  if (
    storage.get() ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    skipPreloader();
    return;
  }

  function mount() {
    try {
      // The React root exists in the static HTML before the app mounts, so it can
      // always be made inert while the dialog is present.
      site = document.getElementById("root");
      overlay = document.createElement("div");
      overlay.id = "fb-preloader";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute(
        "aria-label",
        "در حال آماده‌سازی وب‌سایت بنیان فولاد داریا",
      );
      overlay.innerHTML = `
        <video
          class="fb-preloader__video"
          autoplay
          muted
          playsinline
          preload="metadata"
          poster="/preloader/assets/tr2-poster.jpg"
          aria-hidden="true"
        >
          <source src="/preloader/assets/tr2.mp4" type="video/mp4">
        </video>
        <div class="fb-preloader__shade"></div>
        <div class="fb-preloader__brand" aria-hidden="true">
          <strong>
            <span>بنیان فولاد</span>
            <span class="fb-preloader__accent">داریا</span>
          </strong>
          <span class="fb-preloader__latin" dir="ltr">
            <span>BONYAN FOULAD</span>
            <span class="fb-preloader__accent">DARIA</span>
          </span>
        </div>
        <button class="fb-preloader__play" type="button">
          پخش و ورود به سایت
        </button>
        <button class="fb-preloader__skip" type="button">ورود به سایت</button>
      `;

      document.body.append(overlay);
      document.body.classList.add("fb-preloader-active");
      site?.setAttribute("inert", "");
      site?.setAttribute("aria-hidden", "true");

      video = overlay.querySelector("video");
      const skip = overlay.querySelector(".fb-preloader__skip");
      const play = overlay.querySelector(".fb-preloader__play");
      skip?.addEventListener("click", finish, { once: true });
      video?.addEventListener("ended", finish, { once: true });
      video?.addEventListener("error", showPlaybackPrompt, { once: true });
      play?.addEventListener(
        "click",
        () => {
          if (!video) {
            finish();
            return;
          }

          const playPromise = video.play();
          if (playPromise && typeof playPromise.catch === "function") {
            playPromise.catch(finish);
          }
        },
        { once: true },
      );
      skip?.focus();

      watchdog = window.setTimeout(showPlaybackPrompt, 8000);
      if (video) {
        // Safari requires the muted property itself to be set before play().
        video.muted = true;
        video.playbackRate = 1.25;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(showPlaybackPrompt);
        }
      } else {
        showPlaybackPrompt();
      }
    } catch {
      finish();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
