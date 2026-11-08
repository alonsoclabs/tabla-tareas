# tabla-tareas

Tabla editable para revisar las tareas que salen de una reunión transcrita: agrupa por proyecto y por persona, permite editar el texto y el responsable, mover de proyecto, descartar, ver la cita de la transcripción y marcar lo que se envía.

Está pensada para un widget del chat de Claude: el widget carga este archivo por jsDelivr y le pasa solo los datos, así el widget queda chico.

```html
<div id="tt"></div>
<script src="https://cdn.jsdelivr.net/gh/alonsoclabs/tabla-tareas@v1.0.0/tabla.js"></script>
<script>TablaTareas.montar(document.getElementById('tt'), datos)</script>
```

El formato de `datos` está descrito al inicio de `tabla.js`. Al guardar, la tabla llama a `sendPrompt()` con la lista de cambios en JSON.

Este repositorio solo tiene el código de la tabla; las tareas nunca se suben aquí.
