/* =========================================================================
   HAR INFRA + HAR TRADING COMPANY — Contact delivery
   Sends the contact form and the home-page enquiry strip straight to the
   business inbox. No server needed: the submission is posted as JSON to
   FormSubmit's AJAX endpoint, which relays it as an email — works on any
   static host (Netlify, GitHub Pages, Hostinger, anywhere) with zero
   backend setup.

   ── ONE-TIME ACTIVATION ──────────────────────────────────────────────────
   The very first time a message is ever sent, FormSubmit emails HAR_INBOX
   a confirmation link ("Activate Form" or similar). Click it once and every
   later submission is delivered silently. Until it is clicked, FormSubmit
   rejects every submission outright — it is not held, it fails — so if
   nothing arrives after a first test, check that inbox (and spam) for the
   activation email first.

   ── EMAIL PRESENTATION ───────────────────────────────────────────────────
   _template: "table" lays every field out as a proper bordered table in
   the notification email — FormSubmit's free tier only offers 3 fixed
   layouts ("table" / "box" / "basic"), so a fully custom-branded HTML
   template (logo/colours inside the email) isn't possible on this plan;
   "table" is the one that actually matches "show the data in a table".

   ── VERIFIED BEHAVIOUR (checked directly against FormSubmit's live
      endpoint, not assumed) ────────────────────────────────────────────
     • A page opened as a local file (file://...) gets rejected outright —
       caught here before even attempting the request.
     • _autoresponse (an automatic email back to the visitor) does not work
       over AJAX submissions, so the "thank you" confirmation here is a
       same-page message, not a separate email to the visitor.
   ========================================================================= */
(function () {
    "use strict";

    var HAR_INBOX = "harshadtadha480@gmail.com";
    var HAR_ENDPOINT = "https://formsubmit.co/ajax/" + HAR_INBOX;

    /* ---------------------------------------------------------------- utils */
    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

    function isEmail(v) {
        return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(v || "").trim());
    }

    function fieldOf(input) {
        return input.closest(".har-field");
    }

    function setError(input, msg) {
        var f = fieldOf(input);
        if (!f) return;
        f.classList.add("is-invalid");
        var el = f.querySelector(".har-field-error");
        if (el && msg) el.textContent = msg;
        input.setAttribute("aria-invalid", "true");
    }

    function clearError(input) {
        var f = fieldOf(input);
        if (!f) return;
        f.classList.remove("is-invalid");
        input.removeAttribute("aria-invalid");
    }

    function status(box, type, html) {
        if (!box) return;
        box.className = "is-visible " + (type === "ok" ? "alert-success" : "alert-danger");
        box.innerHTML = html;
        box.setAttribute("role", "status");
    }

    function hideStatus(box) {
        if (!box) return;
        box.className = "";
        box.innerHTML = "";
    }

    /* Build a plain-text fallback so nothing is ever lost if the network or
       the relay is unavailable — the visitor can still send from their own
       mail client with everything already filled in. */
    function mailtoFallback(subject, body) {
        return "mailto:" + HAR_INBOX +
            "?subject=" + encodeURIComponent(subject) +
            "&body=" + encodeURIComponent(body);
    }

    /* Turn a post() failure into a message that actually points at the
       cause, rather than always showing the same generic line. */
    function describeFailure(err) {
        var reason = (err && err.harReason) || "";
        var lower = reason.toLowerCase();
        if (reason === "file-protocol") {
            return "This page is open as a local file (its address starts with \"file://\"), and FormSubmit " +
                "cannot deliver from a page opened that way — it only works once the site is served over " +
                "http:// or https:// (your live domain).";
        }
        if (lower.indexOf("confirm") > -1 || lower.indexOf("activat") > -1 || lower.indexOf("verify") > -1) {
            return "Your message could not be delivered yet because this form's inbox " +
                "(" + HAR_INBOX + ") has not confirmed FormSubmit's one-time activation email. " +
                "Please check that inbox (and its spam folder) for an email from FormSubmit titled something like " +
                "“Activate Form” and click the link in it — every submission before that point is rejected, not just held.";
        }
        if (reason === "network") {
            return "We could not reach the delivery service — please check your internet connection and try again.";
        }
        if (reason) {
            return "We could not send your message automatically (" + reason.replace(/[<>]/g, "") + ").";
        }
        return "We could not send your message automatically.";
    }

    function post(payload) {
        /* FormSubmit's endpoint rejects requests from a page opened as a
           local file with a 500 error and no useful message — verified
           directly against their live endpoint. Catch that up front with a
           message that actually names the cause. */
        if (window.location.protocol === "file:") {
            console.error("HAR contact form: page is open via file:// — FormSubmit cannot deliver from a local file.");
            var fileErr = new Error("Opened as a local file");
            fileErr.harReason = "file-protocol";
            return Promise.reject(fileErr);
        }
        return fetch(HAR_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(payload)
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
                if (!res.ok || String(data.success) === "false") {
                    var reason = data.message || ("HTTP " + res.status);
                    console.error("HAR contact form: FormSubmit rejected the submission —", reason, data);
                    var err = new Error(reason);
                    err.harReason = reason;
                    throw err;
                }
                return data;
            });
        }, function (networkErr) {
            console.error("HAR contact form: network/fetch error —", networkErr);
            var err = new Error("Network error");
            err.harReason = "network";
            throw err;
        });
    }

    /* ------------------------------------------------------- main contact form */
    function initContactForm() {
        var form = $("#ajax_contact");
        if (!form) return;

        var box = $("#form-messages");
        var btn = form.querySelector('button[type="submit"]');
        var btnHTML = btn ? btn.innerHTML : "";

        /* Clear the error state as soon as the visitor starts fixing it */
        $$("input, select, textarea", form).forEach(function (el) {
            el.addEventListener("input", function () { clearError(el); });
            el.addEventListener("change", function () { clearError(el); });
        });

        form.setAttribute("novalidate", "novalidate");

        form.addEventListener("submit", function (e) {
            e.preventDefault();
            e.stopImmediatePropagation();
            hideStatus(box);

            var name = form.querySelector("#fullname");
            var email = form.querySelector("#email");
            var phone = form.querySelector("#phone");
            var subject = form.querySelector("#subject");
            var message = form.querySelector("#message");
            var honey = form.querySelector('[name="_honey"]');

            /* Silently accept and drop bot submissions */
            if (honey && honey.value) { form.reset(); return; }

            var bad = null;
            if (!name.value.trim()) { setError(name, "Please tell us your name."); bad = bad || name; }
            if (!isEmail(email.value)) { setError(email, "Please enter a valid email address."); bad = bad || email; }
            if (phone && phone.value.trim() && phone.value.replace(/[^\d]/g, "").length < 7) {
                setError(phone, "Please enter a valid phone number.");
                bad = bad || phone;
            }
            if (!message.value.trim() || message.value.trim().length < 10) {
                setError(message, "Please add a little more detail (at least 10 characters).");
                bad = bad || message;
            }

            if (bad) {
                bad.focus();
                status(box, "err", "Please correct the highlighted fields and try again.");
                return;
            }

            var enquiry = subject ? subject.value : "General";
            var payload = {
                _subject: "New enquiry — " + enquiry + " — " + name.value.trim(),
                _template: "table",
                _captcha: "false",
                _replyto: email.value.trim(),
                "Full Name": name.value.trim(),
                "Email Address": email.value.trim(),
                "Phone Number": phone && phone.value.trim() ? phone.value.trim() : "Not provided",
                "Enquiry Type": enquiry,
                "Message": message.value.trim(),
                "Submitted": new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) + " (visitor's local time)",
                "Page": window.location.href
            };

            if (btn) {
                btn.disabled = true;
                btn.classList.add("is-sending");
                btn.innerHTML = 'Sending <span class="icon"><i class="fa-regular fa-spinner-third"></i></span>';
            }

            post(payload).then(function () {
                status(box, "ok",
                    "<strong>Thank you for reaching out — your message has been sent!</strong><br>" +
                    "We have received your enquiry and will reply to <strong>" +
                    email.value.trim().replace(/[<>&]/g, "") + "</strong> shortly. " +
                    "For anything urgent, call <a href=\"tel:+919909917969\">+91 99099 17969</a>.");
                form.reset();
            }).catch(function (err) {
                var body =
                    "Name: " + name.value.trim() + "\n" +
                    "Email: " + email.value.trim() + "\n" +
                    "Phone: " + (phone ? phone.value.trim() : "") + "\n" +
                    "Enquiry Type: " + enquiry + "\n\n" +
                    message.value.trim();
                status(box, "err", describeFailure(err) +
                    " Meanwhile, please <a href=\"" + mailtoFallback("HAR enquiry — " + enquiry, body) + "\">email it directly</a> " +
                    "or call <a href=\"tel:+919909917969\">+91 99099 17969</a>.");
            }).then(function () {
                if (btn) {
                    btn.disabled = false;
                    btn.classList.remove("is-sending");
                    btn.innerHTML = btnHTML;
                }
                if (box) box.scrollIntoView({ behavior: "smooth", block: "nearest" });
            });
        }, true);
    }

    /* --------------------------------------------- home-page enquiry strip */
    function initNewsletter() {
        var wrap = $(".newsletter-form");
        if (!wrap) return;

        var input = wrap.querySelector('input[name="email"], #email');
        var btn = wrap.querySelector("button");
        var box = $("#newsletter-message");
        if (!input || !btn) return;

        var btnHTML = btn.innerHTML;

        function send() {
            if (box) { box.className = ""; box.textContent = ""; }
            wrap.classList.remove("is-invalid");

            if (!isEmail(input.value)) {
                wrap.classList.add("is-invalid");
                if (box) { box.className = "alert-danger"; box.textContent = "Please enter a valid business email address."; }
                input.focus();
                return;
            }

            btn.disabled = true;
            btn.classList.add("is-sending");
            btn.innerHTML = '<i class="fa-regular fa-spinner-third"></i>';

            post({
                _subject: "New enquiry request — " + input.value.trim(),
                _template: "table",
                _captcha: "false",
                _replyto: input.value.trim(),
                "Email Address": input.value.trim(),
                "Source": "Home page enquiry strip",
                "Submitted": new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) + " (visitor's local time)",
                "Page": window.location.href
            }).then(function () {
                if (box) {
                    box.className = "alert-success";
                    box.textContent = "Thank you for reaching out — we have your email and our team will be in touch shortly.";
                }
                input.value = "";
            }).catch(function (err) {
                if (box) {
                    box.className = "alert-danger";
                    box.innerHTML = describeFailure(err) + " Meanwhile, please email " +
                        "<a href=\"mailto:" + HAR_INBOX + "\">" + HAR_INBOX + "</a> or call +91 99099 17969.";
                }
            }).then(function () {
                btn.disabled = false;
                btn.classList.remove("is-sending");
                btn.innerHTML = btnHTML;
            });
        }

        btn.addEventListener("click", function (e) { e.preventDefault(); send(); });
        input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { e.preventDefault(); send(); }
        });
    }

    function boot() {
        initContactForm();
        initNewsletter();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})();
