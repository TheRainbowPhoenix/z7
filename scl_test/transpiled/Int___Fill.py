import math

def Int___Fill(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   value: Int
    # VAR_IN_OUT:
    #   data: Array[*] of Int
    # VAR_TEMP:
    #   i: DInt
    #   size: DInt
    context['size'] = UDINT_TO_DINT(Int___CountOfElements(context['data']))
    for _loop_var_1 in range(int(0), int((context['size'] - 1)) + 1):
        context['i'] = _loop_var_1
        context['data'][int(context['i'])] = context['value']
    return
