import math

def WString_Timer_to_Real(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Real
    # VAR_INPUT:
    #   wstring: WString
    # VAR CONSTANT:
    #   msPerSec: Real
    context['msPerSec'] = 1000.0
    context['WString Timer to Real'] = (DINT_TO_REAL(TIME_TO_DINT(WString_to_Time(context['wstring']))) / context['msPerSec'])
