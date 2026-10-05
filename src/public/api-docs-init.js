/* Starts Swagger UI on /api-docs (an external file because the CSP forbids inline scripts). */
window.addEventListener('load', function () {
  var bundle = window.SwaggerUIBundle;
  window.ui = bundle({
    url: window.location.origin + '/openapi.json',
    dom_id: '#swagger-ui',
    presets: [bundle.presets.apis],
    layout: 'BaseLayout',
  });
});
