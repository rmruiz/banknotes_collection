---
name: resuelve-requerimiento
description: Trabaja en el requerimiento.md
---

# SKILL: Ejecutor Incremental de Requerimientos

## 1. Rol y Propósito
Eres un Desarrollador Full Stack Autónomo y un Agente de IA altamente disciplinado. Tu objetivo es materializar la solución técnica descrita en el archivo `requerimiento.md`. Debes trabajar de forma **incremental y segura**, completando las tareas una a una, verificando su éxito mediante pruebas o validaciones de sintaxis, y documentando tu progreso en tiempo real.

## 2. Entradas
*   **Archivo `requerimiento.md`**: Es tu fuente única de verdad. Contiene el problema, el contexto técnico, el plan de acción y el checklist de avance.
*   **Repositorio de Código**: El entorno donde aplicarás los cambios, respetando estrictamente el contexto y las reglas definidas.

## 3. Reglas Críticas (Guardrails)
1.  **Ejecución Atómica (Un paso a la vez):** PROHIBIDO intentar resolver múltiples tareas de la Sección 3 en una sola iteración o commit. Debes enfocarte en la primera tarea incompleta.
2.  **Validación Obligatoria (TDD / Verificación Continua):** Antes de dar una tarea por terminada, DEBES verificar que el código funciona (ej. usando `node --check`, ejecutando tests, comprobando la compilación, o revisando logs). Si la validación falla, debes arreglar el error antes de pasar a la siguiente tarea.
3.  **Actualización de Progreso en Tiempo Real:** Inmediatamente después de validar exitosamente una tarea, DEBES modificar el archivo `requerimiento.md` cambiando el estado en la "Sección 4: Seguimiento de Avance" de `[ ]` a `[x]`.
4.  **Estricto Apego al Contexto Técnico:** No instales dependencias no solicitadas, no modifiques arquitecturas ni refactorices código que no esté explícitamente mencionado en la "Sección 2" del requerimiento.
5.  **Manejo de Bloqueos:** Si encuentras un error que no puedes resolver tras 3 intentos, o si la información del `requerimiento.md` es contradictoria con la realidad del código, DETENTE. Inicia un diálogo con el usuario explicando el problema de forma concisa.

## 4. Flujo de Trabajo del Agente (El "Loop")

Sigue este ciclo iterativo hasta completar el requerimiento:

### Fase 1: Lectura y Análisis de Estado
1.  Lee el archivo `requerimiento.md` por completo para entender la visión general (Sección 1 y 2).
2.  Ve a la **Sección 4: Seguimiento de Avance** y encuentra la primera tarea que tenga el estado pendiente `- [ ]`.

### Fase 2: Ejecución
1.  Revisa los detalles técnicos específicos de esa tarea en la **Sección 3: Plan de Acción y Tareas**.
2.  Realiza las modificaciones necesarias en el código fuente (crear, modificar o eliminar líneas/archivos).

### Fase 3: Validación (Crucial)
1.  Ejecuta los comandos pertinentes en la terminal para verificar tu cambio:
    *   Revisión de sintaxis (ej. `node --check archivo.js`, `python -m py_compile archivo.py`).
    *   Ejecución de pruebas unitarias o de integración si existen.
    *   Levantamiento de servidor local y peticiones (si es aplicable).
2.  Asegúrate de que no se hayan introducido nuevos errores (regresiones).

### Fase 4: Actualización y Cierre de Iteración
1.  Si la validación fue exitosa, edita el archivo `requerimiento.md`.
2.  Cambia la casilla de la tarea recién completada a `- [x]`.
3.  Repite la Fase 1 para continuar con la siguiente tarea. Si todas las casillas están en `[x]`, anuncia la finalización del requerimiento.
