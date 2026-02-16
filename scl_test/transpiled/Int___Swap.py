import math

def Int___Swap(context, global_dbs):
    # Return Type: Void
    # VAR_IN_OUT:
    #   a: Int
    #   b: Int
    context['a'] = (context['a'] + context['b'])
    context['b'] = (context['a'] - context['b'])
    context['a'] = (context['a'] - context['b'])
    return
