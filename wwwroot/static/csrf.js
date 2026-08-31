(function () {
    function getCookie(name) {
        var value = "; " + document.cookie;
        var parts = value.split("; " + name + "=");
        if (parts.length === 2) {
            return parts.pop().split(";").shift();
        }
        return "";
    }

    function isUnsafe(method) {
        return method !== "GET" && method !== "HEAD" && method !== "OPTIONS" && method !== "TRACE";
    }

    if (!window.fetch) {
        return;
    }

    var originalFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
        var req = input instanceof Request ? input : null;
        var method = (init && init.method) || (req && req.method) || "GET";
        method = method.toUpperCase();

        if (isUnsafe(method)) {
            var token = getCookie("XSRF-TOKEN");
            if (token) {
                var headers = new Headers((init && init.headers) || (req && req.headers) || undefined);
                if (!headers.has("X-CSRF-TOKEN")) {
                    headers.set("X-CSRF-TOKEN", token);
                }

                if (req && (!init || !init.headers)) {
                    input = new Request(req, { headers: headers });
                    init = undefined;
                } else {
                    init = Object.assign({}, init, { headers: headers });
                }
            }
        }

        return originalFetch(input, init);
    };

    document.addEventListener("click", function (event) {
        var target = event.target;
        if (!(target instanceof Element)) {
            return;
        }

        var logoutLink = target.closest("a[href='/logout']");
        if (!logoutLink) {
            return;
        }

        event.preventDefault();
        window.fetch("/logout", {
            method: "POST",
            headers: {
                "Accept": "application/json"
            },
            credentials: "same-origin"
        }).finally(function () {
            window.location.assign("/login");
        });
    });
})();
