/* ==========================================================================
   HAR INFRA + HAR TRADING — Operations horizontal scroll
   Owns the #operations ".project-carousel" behaviour:
     • Desktop (>=992px, motion allowed): the gallery pins in view and the
       cards travel horizontally as you scroll; once the last card is reached
       the page resumes normal vertical scrolling.
     • Mobile / tablet / reduced-motion: a native horizontal scroll track with
       snap points (CSS in har-refine.css), driven by the finger rather than
       by page scroll, so every card is always reachable by swiping sideways.
   Loaded AFTER main.js (which no longer initialises this carousel).
   Cooperates with the existing GSAP ScrollSmoother / ScrollTrigger setup.
   ========================================================================== */
(function () {
    "use strict";

    function initOps() {
        if (window.__harOpsInit) return;
        if (typeof gsap === "undefined") return;
        window.__harOpsInit = true;

        if (typeof ScrollTrigger !== "undefined") {
            gsap.registerPlugin(ScrollTrigger);
        }

        var section = document.querySelector(".project-section");
        var carousel = document.querySelector(".project-carousel");
        if (!carousel) return;
        var wrapper = carousel.querySelector(".swiper-wrapper");
        if (!wrapper) return;

        var mm = gsap.matchMedia();

        /* gsap.matchMedia() only auto-fires its callback on registration when at
           least one named condition is already true. "isMobile" is the explicit
           complement of "isDesktop" so the callback also runs immediately on a
           page that first loads at mobile/tablet width — without it, buildSwipe()
           would only ever run after a later resize crossed the 992px line. */
        mm.add(
            {
                isDesktop: "(min-width: 992px)",
                isMobile: "(max-width: 991.98px)",
                reduce: "(prefers-reduced-motion: reduce)"
            },
            function (context) {
                var c = context.conditions;
                return (c.isDesktop && !c.reduce) ? buildHorizontalPin() : buildSwipe();
            }
        );

        /* -------- Desktop: pinned horizontal scroll -------- */
        function buildHorizontalPin() {
            var progress = document.createElement("div");
            progress.className = "";
            var bar = document.createElement("span");
            progress.appendChild(bar);

            var hint = document.createElement("div");
            hint.className = "har-op-hint";
            hint.innerHTML =
                'Scroll to explore ' +
                '<svg viewBox="0 0 30 8" fill="none" aria-hidden="true">' +
                '<path d="M0 4h27M24 1l4 3-4 3" stroke="currentColor" stroke-width="1.4"/></svg>';

            carousel.insertAdjacentElement("afterend", progress);
            progress.insertAdjacentElement("afterend", hint);

            function distance() {
                return Math.max(0, wrapper.scrollWidth - carousel.offsetWidth);
            }

            var tween = gsap.to(wrapper, {
                x: function () { return -distance(); },
                ease: "none",
                scrollTrigger: {
                    trigger: carousel,
                    start: "center center",
                    end: function () { return "+=" + distance(); },
                    pin: carousel,
                    pinSpacing: true,
                    scrub: 1,
                    anticipatePin: 1,
                    invalidateOnRefresh: true,
                    onToggle: function (self) {
                        if (section) section.classList.toggle("is-op-pinned", self.isActive);
                    },
                    onUpdate: function (self) {
                        bar.style.width = (self.progress * 100).toFixed(2) + "%";
                    }
                }
            });
            var st = tween.scrollTrigger;

            /* If there is nothing to travel (e.g. ultrawide viewport), don't pin. */
            if (distance() <= 40 && st) {
                st.kill();
                gsap.set(wrapper, { clearProps: "transform" });
                progress.remove();
                hint.remove();
            }

            requestAnimationFrame(function () {
                if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
            });

            return function cleanup() {
                if (st) st.kill();
                if (tween) tween.kill();
                gsap.set(wrapper, { clearProps: "transform" });
                if (progress.parentNode) progress.remove();
                if (hint.parentNode) hint.remove();
                if (section) section.classList.remove("is-op-pinned");
            };
        }

        /* -------- Mobile / tablet / reduced-motion: native swipe track --------
           A real horizontal scroller beats a JS carousel here: it keeps the
           platform's own momentum, snapping and scrollbar, it cannot fall out
           of sync with the pinned desktop version, and it still works if the
           Swiper bundle fails to load. All the layout lives in CSS; this only
           resets the desktop transform and adds the swipe affordance. */
        function buildSwipe() {
            gsap.set(wrapper, { clearProps: "transform" });
            carousel.scrollLeft = 0;

            var hint = document.createElement("div");
            hint.className = "har-op-swipe-hint";
            hint.innerHTML =
                '<svg viewBox="0 0 30 8" fill="none" aria-hidden="true">' +
                '<path d="M0 4h25M22 1l4 3-4 3" stroke-width="1.4" stroke-linecap="round" ' +
                'stroke-linejoin="round"/></svg> Swipe to explore';
            carousel.insertAdjacentElement("afterend", hint);

            /* Hide the prompt once the visitor has actually swiped. */
            function onScroll() {
                if (carousel.scrollLeft > 24) {
                    hint.style.opacity = "0";
                    carousel.removeEventListener("scroll", onScroll);
                }
            }
            hint.style.transition = "opacity .4s ease";
            carousel.addEventListener("scroll", onScroll, { passive: true });

            return function cleanup() {
                carousel.removeEventListener("scroll", onScroll);
                if (hint.parentNode) hint.remove();
            };
        }
    }

    /* Close the off-canvas sidebar once a link inside it is used. Without this
       an in-page anchor (e.g. #global-presence) would scroll the page behind a
       panel that stays open. */
    function initSidebarDismiss() {
        var panel = document.getElementById("sidebar-area");
        if (!panel) return;
        panel.addEventListener("click", function (e) {
            var link = e.target.closest("a[href]");
            if (!link || link.classList.contains("venobox")) return;
            document.body.classList.remove("open-sidebar");
        });
    }

    if (document.readyState === "complete") {
        setTimeout(initOps, 300);
        initSidebarDismiss();
    } else {
        window.addEventListener("load", function () { setTimeout(initOps, 300); });
        document.addEventListener("DOMContentLoaded", initSidebarDismiss);
    }

    /* ----------------------------------------------------------------------
       Hash-anchor scrolling under GSAP ScrollSmoother.
       ScrollSmoother replaces native page scroll with a transformed wrapper,
       so a plain "#section" URL (typed, deep-linked from another page, or
       clicked while already on the page) no longer lands in the right place
       on its own. This retargets both cases through ScrollSmoother's own
       scrollTo when available, falling back to a plain offset scroll.
       ---------------------------------------------------------------------- */
    function scrollToHashTarget(id) {
        var target = document.getElementById(id);
        if (!target) return false;
        var smoother = (typeof ScrollSmoother !== "undefined") ? ScrollSmoother.get() : null;
        var offset = window.innerWidth < 992 ? 80 : 110;
        if (smoother) {
            smoother.scrollTo(target, true, "top " + offset + "px");
        } else if (typeof gsap !== "undefined" && gsap.to) {
            gsap.to(window, { duration: 0.9, scrollTo: { y: target, offsetY: offset } });
        } else {
            var y = target.getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top: y, behavior: "smooth" });
        }
        return true;
    }

    function initHashScroll() {
        if (location.hash) {
            var id = location.hash.slice(1);
            var attempts = 0;
            var tryScroll = function () {
                attempts++;
                var ok = document.getElementById(id) &&
                    (typeof ScrollSmoother === "undefined" || ScrollSmoother.get());
                if (ok) {
                    scrollToHashTarget(id);
                } else if (attempts < 40) {
                    setTimeout(tryScroll, 100);
                }
            };
            setTimeout(tryScroll, 350);
        }

        document.addEventListener("click", function (e) {
            var link = e.target.closest('a[href*="#"]');
            if (!link) return;
            var href = link.getAttribute("href") || "";
            var hashIndex = href.indexOf("#");
            if (hashIndex === -1) return;
            var path = href.slice(0, hashIndex);
            var id = href.slice(hashIndex + 1);
            if (!id) return;
            var samePage = path === "" || path === location.pathname.split("/").pop();
            if (!samePage) return;
            if (!document.getElementById(id)) return;
            e.preventDefault();
            document.body.classList.remove("open-sidebar");
            history.pushState(null, "", "#" + id);
            scrollToHashTarget(id);
        });
    }

    if (document.readyState === "complete") {
        initHashScroll();
    } else {
        window.addEventListener("load", initHashScroll);
    }
})();
