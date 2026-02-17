import math

def Int___ShiftLeft(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   places: DInt
    # VAR_IN_OUT:
    #   data: Array[*] of Int
    # VAR_TEMP:
    #   i: DInt
    #   size: DInt
    if (context['places'] <= 0):
        return
    context['size'] = UDINT_TO_DINT(Int___CountOfElements(context['data']))
    if (context['places'] >= context['size']):
        Int___Fill(value=0, data=context['data'])
        return
    for _loop_var_1 in range(int(0), int((context['size'] - 1)) + 1):
        context['i'] = _loop_var_1
        if ((context['i'] + context['places']) > (context['size'] - 1)):
            break
        context['data'][int(context['i'])] = context['data'][int((context['i'] + context['places']))]
    for _loop_var_1 in range(int((context['size'] - 1)), int((context['size'] - context['places'])) + 1):
        context['i'] = _loop_var_1
        context['data'][int(context['i'])] = 0
    return
