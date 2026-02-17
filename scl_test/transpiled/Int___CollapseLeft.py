import math

def Int___CollapseLeft(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   null_token: Int
    # VAR_IN_OUT:
    #   array: Array[*] of Int
    # VAR_TEMP:
    #   i: DInt
    #   scanner: DInt
    #   size: DInt
    context['size'] = UDINT_TO_DINT(Int___CountOfElements(context['array']))
    for _loop_var_1 in range(int(0), int((context['size'] - 1)) + 1):
        context['i'] = _loop_var_1
        if (context['array'][int(context['i'])] != context['null_token']):
            context['CONTINUE']
        context['scanner'] = context['i']
        while (context['array'][int(context['scanner'])] == context['null_token']):
            context['scanner'] = (context['scanner'] + 1)
            if (context['scanner'] == context['size']):
                return
        context['array'][int(context['i'])] = context['array'][int(context['scanner'])]
        context['array'][int(context['scanner'])] = context['null_token']
    return
