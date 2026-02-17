import math

def Int___Split(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   array: Array[*] of Int
    #   null_token: Int
    # VAR_OUTPUT:
    #   left: Array[*] of Int
    #   left_length: DInt
    #   right: Array[*] of Int
    #   right_length: DInt
    # VAR_TEMP:
    #   i: DInt
    #   i_l: DInt
    #   i_r: DInt
    #   mid: DInt
    #   size: DInt
    Int___Fill(value=context['null_token'], data=context['left'])
    Int___Fill(value=context['null_token'], data=context['right'])
    context['size'] = UDINT_TO_DINT(Int___CountOfElements(context['array']))
    context['mid'] = (context['size'] / 2)
    context['left_length'] = context['mid']
    context['right_length'] = context['mid']
    if ((context['size'] % 2) != 0):
        context['right_length'] = (context['right_length'] + 1)
    for _loop_var_1 in range(int(0), int((context['size'] - 1)) + 1):
        context['i'] = _loop_var_1
        if (context['i'] < context['mid']):
            context['left'][int(context['i_l'])] = context['array'][int(context['i'])]
            context['i_l'] = (context['i_l'] + 1)
            context['CONTINUE']
        context['right'][int(context['i_r'])] = context['array'][int(context['i'])]
        context['i_r'] = (context['i_r'] + 1)
    return
