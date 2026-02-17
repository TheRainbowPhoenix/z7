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


def Code_128_Calculate_Checksum(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Int
    # VAR_INPUT:
    #   characters: Array[0..255] of Byte
    #   count: UInt
    # VAR_TEMP:
    #   _check_sum: Int
    #   _i: Int
    context['_check_sum'] = 104
    for _loop_var_1 in range(int(0), int(UINT_TO_INT((context['count'] - 1))) + 1):
        context['_i'] = _loop_var_1
        context['_check_sum'] = (context['_check_sum'] + ((BYTE_TO_INT(context['characters'][int(context['_i'])]) - 32) * (context['_i'] + 1)))
    context['_check_sum'] = ((context['_check_sum'] % 103) + 32)
    if (context['_check_sum'] >= 127):
        context['_check_sum'] = (context['_check_sum'] + 68)
    context['Code_128.Calculate_Checksum'] = context['_check_sum']


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


def Code_128_String_to_Code(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   part_number: String
    # VAR_TEMP:
    #   _characters: Array[0..255] of Byte
    #   _check_sum: Int
    #   _count: UInt
    #   _i: Int
    # VAR CONSTANT:
    #   START: Char
    context['START'] = 'Ì'
    #   STOP: Char
    context['STOP'] = 'Î'
    Strg_TO_Chars(Strg=context['part_number'], pChars=0, Cnt=context['_count'], Chars=context['_characters'])
    context['_check_sum'] = Code_128_Calculate_Checksum(characters=context['_characters'], count=context['_count'])
    Byte_Array_Shift(shift_by=1, characters=context['_characters'])
    context['_characters'][int(0)] = CHAR_TO_BYTE(context['START'])
    context['_characters'][int((context['_count'] + 1))] = INT_TO_BYTE(context['_check_sum'])
    context['_characters'][int((context['_count'] + 2))] = CHAR_TO_BYTE(context['STOP'])
    Chars_TO_Strg(Chars=context['_characters'], pChars=0, Cnt=(context['_count'] + 3), Strg=context['Code_128.String_to_Code'])
