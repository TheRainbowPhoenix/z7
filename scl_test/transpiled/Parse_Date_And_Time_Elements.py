import math

def Trim(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   string: String
    # VAR_TEMP:
    #   ret: String
    # VAR CONSTANT:
    #   space: String
    context['space'] = ' '
    context['ret'] = context['string']
    while (LEFT(IN=context['ret'], L=1) == context['space']):
        context['ret'] = RIGHT(IN=context['ret'], L=(LEN(context['ret']) - 1))
    while (RIGHT(IN=context['ret'], L=1) == context['space']):
        context['ret'] = LEFT(IN=context['ret'], L=(LEN(context['ret']) - 1))
    context['Trim'] = context['ret']


def Strip_Sign(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   string: String
    # VAR_TEMP:
    #   Length: Int
    #   String Box: String
    #   Test Character: String
    # VAR CONSTANT:
    #   +: Char
    context['+'] = '+'
    #   -: Char
    context['-'] = '-'
    context['String Box'] = context['string']
    context['Test Character'] = LEFT_STRING(IN=context['String Box'], L=1)
    if (((context['Test Character'] == context['+']) or context['Test Character']) == context['-']):
        context['Length'] = LEN(context['String Box'])
        context['String Box'] = RIGHT_STRING(IN=context['String Box'], L=(context['Length'] - 1))
    context['Strip Sign'] = context['String Box']


def Parse_Date_And_Time_Elements(context, global_dbs):
    # Return Type: Void
    # VAR_INPUT:
    #   date & Time: Date_And_Time
    # VAR_OUTPUT:
    #   elements as string array: String Buffer
    # VAR_TEMP:
    #   byteBuffer: Byte Buffer
    #   pos: DInt
    #   ret: String Buffer
    #   _ret_val: Int
    #   pBuffer: Int
    context['_ret_val'] = Serialize(SRC_VARIABLE=context['date & Time'], DEST_ARRAY=context['byteBuffer'].me, POS=context['pos'])
    for _loop_var_1 in range(int(0), int(7) + 1):
        context['pBuffer'] = _loop_var_1
        context['ret'].me[int(context['pBuffer'])] = Trim(Strip_Sign(INT_TO_STRING(BCD16_TO_INT(BYTE_TO_WORD(context['byteBuffer'].me[int(context['pBuffer'])])))))
    context['elements as string array'] = context['ret']
