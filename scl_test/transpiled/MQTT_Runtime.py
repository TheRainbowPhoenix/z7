import math

def mqttRuntime(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   IN: Bool
    #   RES: Bool
    # VAR_OUTPUT:
    #   RTIME: Time
    # VAR:
    #   last: DInt
    #   now: DInt
    #   run: DInt
    #   FP_IN: Bool
    if (context['IN'] and (not context['FP_IN'])):
        context['last'] = 0
        context['FP_IN'] = True
    if ((not context['IN']) and context['FP_IN']):
        context['FP_IN'] = False
    if (context['IN'] and (not context['RES'])):
        context['now'] = DWORD_TO_DINT(Unixtime())
        if (context['last'] == 0):
            context['last'] = context['now']
            pass # GOTO Out (Not supported)
        else:
            context['run'] = (context['run'] + (context['now'] - context['last']))
            context['last'] = context['now']
    if (context['IN'] and context['RES']):
        context['run'] = 0
        context['now'] = 0
        context['last'] = 0
    else:
        if ((not context['IN']) and context['RES']):
            context['run'] = 0
            context['now'] = 0
            context['last'] = 0
    if (context['run'] >= 2073600):
        context['run'] = 0
    pass # LABEL Out
    context['RTIME'] = DINT_TO_TIME((context['run'] * 1000))
