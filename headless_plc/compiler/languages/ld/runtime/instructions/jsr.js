export function jsr(context, log, scanTime, routineName) {
    if (context.routines && context.routines[routineName]) {
        // Execute routine
        // We assume routines are compiled to functions accepting (vars, log, scanTime)
        // context.routines[routineName](context.vars, log, scanTime);
        // But wait, context in generated code is 'vars'.
        // The structure needs to be clearer.
        // If we compile all routines, we need a way to pass them.
        // Currently runLogic(variables, logs, ...)

        // We will inject a global '__routines' object into context/vars?
        // Or pass it as a separate argument.

        if (context.__routines && context.__routines[routineName]) {
             context.__routines[routineName](context, log, scanTime);
        } else {
             // log.push(`Warning: Routine ${routineName} not found`);
        }
    }
    return true; // Output is always true for JSR usually, or follows EN
}
