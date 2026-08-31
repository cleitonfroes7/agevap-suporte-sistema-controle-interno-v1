// Loader to fetch a target script, fix literal "\\n" tokens, and execute it
(function() {
  try {
    var current = document.currentScript;
    var target = current && current.getAttribute('data-target');
    if (!target) return;

    var base = new URL(current.src, window.location.href);
    // Build final URL under the same directory as this loader
    var targetUrl = new URL(target, base);

    fetch(targetUrl.toString(), { credentials: 'same-origin' })
      .then(function(res) { return res.text(); })
      .then(function(code) {
        // Replace stray literal backslash-n sequences with real newlines
        try {
          code = code.replace(/\\n/g, '\n');
        } catch (e) {
          // no-op; if replace fails, proceed with original code
        }

        var s = document.createElement('script');
        s.type = 'text/javascript';
        s.text = code;
        // Insert right after this loader tag
        if (current && current.parentNode) {
          current.parentNode.insertBefore(s, current.nextSibling);
        } else {
          (document.head || document.documentElement).appendChild(s);
        }
        // Ensure late-loaded scripts that listen to DOMContentLoaded still run
        try {
          if (document.readyState !== 'loading') {
            var evt = document.createEvent ? document.createEvent('Event') : null;
            if (evt && evt.initEvent) {
              evt.initEvent('DOMContentLoaded', true, true);
              document.dispatchEvent(evt);
            } else if (typeof Event === 'function') {
              document.dispatchEvent(new Event('DOMContentLoaded'));
            }
          }
        } catch (e) {
          // ignore
        }
      })
      .catch(function(err) {
        console.error('Falha ao carregar script alvo:', target, err);
      });
  } catch (err) {
    console.error('Erro no script_loader_fix:', err);
  }
})();
