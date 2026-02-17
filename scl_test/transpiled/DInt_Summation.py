import math

def DInt_Summation(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: UDInt
    # VAR_INPUT:
    #   start_index: DInt
    #   end_index: DInt
    context['DInt.Summation'] = REAL_TO_UDINT((((context['end_index'] - context['start_index']) * ((context['end_index'] - context['start_index']) + 1)) / 2))
    return
