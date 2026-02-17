import math

def Real_to_WString_Timer(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: WString
    # VAR_INPUT:
    #   realVal: Real
    # VAR CONSTANT:
    #   msPerSec: Real
    context['msPerSec'] = 1000.0
    context['Real to WString Timer'] = Time_to_WString(DINT_TO_TIME(REAL_TO_DINT((context['realVal'] * context['msPerSec']))))
