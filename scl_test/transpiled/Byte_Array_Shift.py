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


def Byte_Array_Shift(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   shift_by: Int
    # VAR_IN_OUT:
    #   characters: Array[*] of Byte
    # VAR_TEMP:
    #   _by: Int
    #   _i: Int
    #   _length: Int
    #   _offset: Int
    #   _start: Int
    #   _stop: Int
    if (context['shift_by'] == 0):
        return
    context['_length'] = (UDINT_TO_INT(Array_Any_Length(context['characters'])) - 1)
    if (context['shift_by'] < 0):
        context['_start'] = 0
        context['_stop'] = context['_length']
        context['_by'] = 1
    if (context['shift_by'] > 0):
        context['_start'] = context['_length']
        context['_stop'] = 0
        context['_by'] = (-1)
    for _loop_var_1 in range(int(context['_start']), int(context['_stop']) + 1):
        context['_i'] = _loop_var_1
        context['_by']
        context['_offset'] = (context['_i'] - context['shift_by'])
        if (context['_offset'] < 0):
            break
        if (context['_offset'] > context['_length']):
            break
        context['characters'][int(context['_i'])] = context['characters'][int(context['_offset'])]
        context['characters'][int(context['_offset'])] = ' '
