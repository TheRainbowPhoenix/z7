import math

def Int___Clear(context=None, global_dbs=None, **kwargs):
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
    #   size: DInt
    Int___Fill(value=context['null_token'], data=context['array'])
    return
