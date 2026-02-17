import math

def Int___CountOfElements(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: UDInt
    # VAR_INPUT:
    #   data: Variant
    context['Int[].CountOfElements'] = CountOfElements(context['data'])
    return
