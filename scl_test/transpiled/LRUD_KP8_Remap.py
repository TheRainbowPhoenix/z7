import math

def LRUD_KP8_Remap(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Int
    # VAR_INPUT:
    #   btnNum: Int
    # VAR_TEMP:
    #   output: Int
    if ((context['btnNum'] % 2) == 0):
        context['output'] = (7 - (context['btnNum'] / 2))
    if ((context['btnNum'] % 2) != 0):
        context['output'] = (3 - (context['btnNum'] / 2))
    context['LRUD KP8 Remap'] = context['output']
