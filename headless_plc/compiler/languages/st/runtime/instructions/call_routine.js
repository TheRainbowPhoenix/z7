export function call_routine(context, log, scanTime, routines, routineName) {
    if (routines && routines[routineName]) {
        routines[routineName](context, log, scanTime, routines);
    } else {
        log.push('Warning: Routine ' + routineName + ' not found');
    }
}
