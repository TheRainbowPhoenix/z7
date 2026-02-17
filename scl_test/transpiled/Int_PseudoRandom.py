import math

def Int_PseudoRandom(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_OUTPUT:
    #   value: Int
    # VAR:
    #   runtime: Runtime.UDT
    # VAR CONSTANT:
    #   OFFSET: LReal
    context['OFFSET'] = 10000000.0
    context['runtime'].time_delta = RUNTIME(context['runtime'].clock)
    context['runtime'].time_delta = (context['runtime'].time_delta * context['OFFSET'])
    context['value'] = (LREAL_TO_INT(context['runtime'].time_delta) % 100)
