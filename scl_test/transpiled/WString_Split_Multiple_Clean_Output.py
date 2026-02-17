import math

def Array_Any_Length(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: UDInt
    # VAR_INPUT:
    #   array: Variant
    # VAR_TEMP:
    #   status: DInt
    #   ret: UDInt
    context['ret'] = CountOfElements(context['array'])
    context['Array.Any.Length'] = context['ret']


def WString_Split_Multiple_Clean_Output(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   pointer: Int
    # VAR_IN_OUT:
    #   substrings: Array[*] of WString
    # VAR_TEMP:
    #   _i: Int
    # VAR CONSTANT:
    #   BLANK: WString
    for _loop_var_1 in range(int(context['pointer']), int((UDINT_TO_INT(Array_Any_Length(context['substrings'])) - 1)) + 1):
        context['_i'] = _loop_var_1
        context['substrings'][int(context['_i'])] = ''
