// ========================================
// HEALTHKART - SHARED UI HELPERS
// Toast notifications + confirmation dialog
// ========================================

const cssHref = new URL("../css/ui.css", import.meta.url).href;

if (!document.querySelector("link[data-hk-ui]")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssHref;
    link.setAttribute("data-hk-ui", "");
    document.head.appendChild(link);
}

function toastContainer() {
    let box = document.getElementById("hk-toasts");
    if (!box) {
        box = document.createElement("div");
        box.id = "hk-toasts";
        box.setAttribute("aria-live", "polite");
        document.body.appendChild(box);
    }
    return box;
}

const ICONS = {
    success: "fa-circle-check",
    error: "fa-circle-exclamation",
    info: "fa-circle-info",
    warning: "fa-triangle-exclamation"
};

export function toast(message, type = "info", duration = 4500) {
    const el = document.createElement("div");
    el.className = "hk-toast hk-toast-" + type;
    el.setAttribute("role", type === "error" ? "alert" : "status");

    const icon = document.createElement("i");
    icon.className = "fa-solid " + (ICONS[type] || ICONS.info);

    const text = document.createElement("span");
    text.textContent = message;

    const close = document.createElement("button");
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss");
    close.textContent = "×";

    el.append(icon, text, close);
    toastContainer().appendChild(el);

    const remove = () => {
        el.classList.add("hk-toast-out");
        setTimeout(() => el.remove(), 200);
    };
    close.addEventListener("click", remove);
    if (duration > 0) setTimeout(remove, duration);
    return remove;
}

export function confirmDialog({
    title = "Are you sure?",
    message = "",
    confirmText = "Confirm",
    cancelText = "Cancel",
    danger = false
} = {}) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "hk-dialog-overlay";

        const box = document.createElement("div");
        box.className = "hk-dialog";
        box.setAttribute("role", "alertdialog");
        box.setAttribute("aria-modal", "true");

        const h = document.createElement("h3");
        h.textContent = title;
        const p = document.createElement("p");
        p.textContent = message;

        const actions = document.createElement("div");
        actions.className = "hk-dialog-actions";

        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "hk-btn hk-btn-light";
        cancel.textContent = cancelText;

        const ok = document.createElement("button");
        ok.type = "button";
        ok.className = "hk-btn " + (danger ? "hk-btn-danger" : "hk-btn-primary");
        ok.textContent = confirmText;

        actions.append(cancel, ok);
        box.append(h, p, actions);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        ok.focus();

        function done(result) {
            document.removeEventListener("keydown", onKey);
            overlay.remove();
            resolve(result);
        }
        function onKey(e) {
            if (e.key === "Escape") done(false);
        }

        document.addEventListener("keydown", onKey);
        cancel.addEventListener("click", () => done(false));
        ok.addEventListener("click", () => done(true));
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) done(false);
        });
    });
}
