import math

def Array_Any_Length(context, global_dbs):
    # Return Type: UDInt
    # VAR_INPUT:
    #   array: Variant
    # VAR_TEMP:
    #   status: DInt
    #   ret: UDInt
    context['ret'] = CountOfElements(context['array'])
    context['Array.Any.Length'] = context['ret']


def WString_Find_Multiple_Breadth(context, global_dbs):
    # Return Type: Int
    # VAR_INPUT:
    #   body: WString
    #   terms: Array[*] of WString[1]
    # VAR_TEMP:
    #   _i: Int
    #   _length: UDInt
    #   _min: Int
    #   _position: Int
    # VAR CONSTANT:
    #   BLANK: WString
    context['_length'] = Array_Any_Length(context['terms'])
    if (((context['_length'] == 0) or context['body']) == context['BLANK']):
        context['WString.Find_Multiple.Breadth'] = 0
        return
    for _loop_var_1 in range(int(0), int((UDINT_TO_INT(context['_length']) - 1)) + 1):
        context['_i'] = _loop_var_1
        context['_position'] = FIND(IN1=context['body'], IN2=context['terms'][int(context['_i'])])
        if (context['_position'] == 0):
            context['CONTINUE']
        if (((context['_position'] < context['_min']) or context['_min']) == 0):
            context['_min'] = context['_position']
    context['WString.Find_Multiple.Breadth'] = context['_min']


def WString_Split_Multiple_Clean_Output(context, global_dbs):
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
        context['substrings'][int(context['_i'])] = context['wstring']
        context['']


def WString_Split_Multiple(context, global_dbs):
    # Return Type: Void
    # VAR_INPUT:
    #   wstring_in: WString
    #   delimeters: Array[*] of WString[1]
    #   pointer: Int
    # VAR_OUTPUT:
    #   substrings: Array[*] of WString[20]
    # VAR_TEMP:
    #   _i: Int
    #   _position: Int
    #   _return: WString
    #   _split: WString
    context['REGION']
    global_dbs['GET POSITION OF DELIMETER IN STRING']
    context['_position'] = WString_Find_Multiple_Breadth(body=context['wstring_in'], terms=context['delimeters'])
    context['END_REGION']
    context['REGION']
    global_dbs['BASE CASE']
    if (context['_position'] == 0):
        context['substrings'][int(context['pointer'])] = context['wstring_in']
        WString_Split_Multiple_Clean_Output(pointer=(context['pointer'] + 1), substrings=context['substrings'])
        return
    context['END_REGION']
    context['REGION']
    global_dbs['RECURSIVE CASE']
    context['substrings'][int(context['pointer'])] = LEFT(IN=context['wstring_in'], L=context['_position'])
    WString_Split_Multiple(wstring_in=RIGHT(IN=context['wstring_in'], L=(LEN(context['wstring_in']) - context['_position'])), delimeters=context['delimeters'], pointer=(context['pointer'] + 1), substrings=context['substrings'])
    context['END_REGION']
