import math

def Int___Swap(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_IN_OUT:
    #   a: Int
    #   b: Int
    context['a'] = (context['a'] + context['b'])
    context['b'] = (context['a'] - context['b'])
    context['a'] = (context['a'] - context['b'])
    return
