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


def Array_WString_Is_Element(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Bool
    # VAR_INPUT:
    #   search_term: WString
    #   search_array: Array[*] of WString[1]
    # VAR_TEMP:
    #   _i: Int
    #   _length_search_array: UDInt
    context['_length_search_array'] = Array_Any_Length(context['search_array'])
    for _loop_var_1 in range(int(0), int(UDINT_TO_INT((context['_length_search_array'] - 1))) + 1):
        context['_i'] = _loop_var_1
        if (context['search_term'] == context['search_array'][int(context['_i'])]):
            context['Array.WString.Is_Element'] = True
            return
    context['Array.WString.Is_Element'] = False


def Trim(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: WString
    # VAR_INPUT:
    #   wString: WString
    # VAR_TEMP:
    #   ret: WString
    # VAR CONSTANT:
    #   space: WString
    context['space'] = ' '
    context['ret'] = context['wString']
    while (LEFT(IN=context['ret'], L=1) == context['space']):
        context['ret'] = RIGHT(IN=context['ret'], L=(LEN(context['ret']) - 1))
    while (RIGHT(IN=context['ret'], L=1) == context['space']):
        context['ret'] = LEFT(IN=context['ret'], L=(LEN(context['ret']) - 1))
    context['Trim'] = context['ret']


def WString_Word_Wrap(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: WString
    # VAR_INPUT:
    #   delimeters: Array[*] of WString[1]
    #   line_length: Int
    #   wstring_in: WString
    # VAR_TEMP:
    #   _i: Int
    #   _substring_length: Int
    #   _wstring_in_length: Int
    #   _pointer_substrings: Int
    #   _substring: WString
    #   _position_of_last_delimeter: Int
    #   _recurse: Bool
    #   _string_split_right: WString
    # VAR CONSTANT:
    #   BLANK: WString
    #   NEW_LINE: WString
    context['NEW_LINE'] = '$L'
    context['_wstring_in_length'] = LEN(context['wstring_in'])
    if (context['line_length'] == 0):
        context['WString.Word_Wrap'] = context['BLANK']
        return
    for _loop_var_1 in range(int(1), int(context['_wstring_in_length']) + 1):
        context['_i'] = _loop_var_1
        context['_substring'] = CONCAT_WSTRING(IN1=context['_substring'], IN2=context['wstring_in'][int(context['_i'])])
        context['_substring_length'] = LEN(context['_substring'])
        if Array_WString_Is_Element(search_term=context['wstring_in'][int(context['_i'])], search_array=context['delimeters']):
            context['_position_of_last_delimeter'] = context['_i']
        if (context['wstring_in'][int(context['_i'])] == context['NEW_LINE']):
            context['_substring'] = LEFT_WSTRING(IN=context['_substring'], L=(context['_substring_length'] - 1))
            context['_string_split_right'] = RIGHT_WSTRING(IN=context['wstring_in'], L=(context['_wstring_in_length'] - context['_i']))
            context['_recurse'] = True
        if ((context['_substring_length'] == context['line_length']) and (context['_position_of_last_delimeter'] != 0)):
            context['_substring'] = LEFT_WSTRING(IN=context['_substring'], L=context['_position_of_last_delimeter'])
            context['_string_split_right'] = RIGHT_WSTRING(IN=context['wstring_in'], L=(context['_wstring_in_length'] - context['_position_of_last_delimeter']))
            context['_recurse'] = True
        if ((context['_substring_length'] == context['line_length']) and (context['_position_of_last_delimeter'] == 0)):
            context['_string_split_right'] = RIGHT_WSTRING(IN=context['wstring_in'], L=(context['_wstring_in_length'] - context['_substring_length']))
            context['_recurse'] = True
        if context['_recurse']:
            context['_substring'] = CONCAT_WSTRING(IN1=Trim(context['_substring']), IN2=context['NEW_LINE'], IN3=WString_Word_Wrap(delimeters=context['delimeters'], line_length=context['line_length'], wstring_in=context['_string_split_right']))
            context['WString.Word_Wrap'] = context['_substring']
            return
    context['WString.Word_Wrap'] = Trim(context['_substring'])
