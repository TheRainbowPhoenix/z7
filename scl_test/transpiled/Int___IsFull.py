import math

def Int___IsFull(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Bool
    # VAR_INPUT:
    #   array: Array[*] of Int
    #   null_value: Int
    # VAR_TEMP:
    #   i: DInt
    #   size: DInt
    context['size'] = UDINT_TO_DINT(Int___CountOfElements(context['array']))
    for _loop_var_1 in range(int(0), int((context['size'] - 1)) + 1):
        context['i'] = _loop_var_1
        if (context['array'][int(context['i'])] == context['null_value']):
            context['Int[].IsFull'] = False
            return
    context['Int[].IsFull'] = True
