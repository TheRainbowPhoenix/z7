import math

def Int___Search(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Int
    # VAR_INPUT:
    #   haystack: Array[*] of Int
    #   needle: Int
    # VAR_TEMP:
    #   size: DInt
    #   i: DInt
    context['size'] = UDINT_TO_INT(Int___CountOfElements(context['haystack']))
    for _loop_var_1 in range(int(0), int((context['size'] - 1)) + 1):
        context['i'] = _loop_var_1
        if (context['haystack'][int(context['i'])] == context['needle']):
            context['Int[].Search'] = DINT_TO_INT(context['i'])
            return
    context['Int[].Search'] = (-1)
    return
