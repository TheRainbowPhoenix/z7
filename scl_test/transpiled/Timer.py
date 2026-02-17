import math

def Timer(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   control: Timer.Control
    #   settings: Timer.Settings
    # VAR_OUTPUT:
    #   feedback: Timer.Feedback
    # VAR:
    #   rt: Runtime.All_Data
    #   state: Int
    #   last: Struct
    #   _feedback: Timer.Feedback
    # VAR_TEMP:
    #   blank_timer: Timer.All_Data
    # VAR CONSTANT:
    #   expired: Int
    context['expired'] = 0
    #   idle: Int
    context['idle'] = 1
    #   reset: Int
    context['reset'] = 2
    #   restart: Int
    context['restart'] = 3
    #   running: Int
    context['running'] = 4
    #   stopped: Int
    context['stopped'] = 5
    if (context['control'].reset and (not context['last'].reset)):
        context['state'] = context['reset']
        pass # GOTO EXEC (Not supported)
    if (context['state'] == context['running']):
        if (context['control'].stop and (not context['last'].stop)):
            context['state'] = context['stopped']
            pass # GOTO EXEC (Not supported)
    if (context['state'] == context['running']):
        if (context['control'].start and (not context['last'].run)):
            context['state'] = context['restart']
            pass # GOTO EXEC (Not supported)
    if (context['state'] == context['running']):
        if (context['rt'].ellapsed >= context['settings'].limit):
            context['state'] = context['expired']
            pass # GOTO EXEC (Not supported)
    if (context['state'] != context['running']):
        if (context['control'].start and (not context['last'].run)):
            context['state'] = context['running']
            pass # GOTO EXEC (Not supported)
    if (context['state'] == context['running']):
        context['state'] = context['running']
        pass # GOTO EXEC (Not supported)
    context['state'] = context['idle']
    pass # LABEL EXEC
    _case_val_1 = context['state']
    if _case_val_1 == context['expired']:
        context['rt'].ellapsed = 0.0
        context['rt'].memory = 0.0
        context['_feedback'].expired = True
        context['state'] = context['idle']
    elif _case_val_1 == context['idle']:
        context['state'] = context['idle']
    elif _case_val_1 == context['reset']:
        context['rt'] = context['blank_timer'].runtime_function
        context['_feedback'] = context['blank_timer'].feedback
        context['state'] = context['idle']
    elif _case_val_1 == context['restart']:
        context['rt'] = context['blank_timer'].runtime_function
        context['_feedback'] = context['blank_timer'].feedback
        context['state'] = context['running']
    elif _case_val_1 == context['running']:
        context['rt'].ellapsed = (context['rt'].ellapsed + RUNTIME(context['rt'].memory))
        context['_feedback'].ellapsed = context['rt'].ellapsed
        context['_feedback'].expired = False
        context['_feedback'].running = True
        context['_feedback'].stopped = False
        context['state'] = context['running']
    elif _case_val_1 == context['stopped']:
        context['rt'].memory = 0.0
        context['_feedback'].running = False
        context['_feedback'].stopped = True
        context['state'] = context['idle']
    else:
        context['state'] = context['idle']
    pass # LABEL END
    context['last'].reset = context['control'].reset
    context['last'].run = context['control'].start
    context['last'].stop = context['control'].stop
    context['feedback'] = context['_feedback']
