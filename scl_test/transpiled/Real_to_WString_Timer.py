import math

def Real_to_WString_Timer(context, global_dbs):
    # Return Type: WString
    # VAR_INPUT:
    #   realVal: Real
    # VAR CONSTANT:
    #   msPerSec: Real
    context['msPerSec'] = 1000.0
    context['Real to WString Timer'] = Time_to_WString(DINT_TO_TIME(REAL_TO_DINT((context['realVal'] * context['msPerSec']))))
