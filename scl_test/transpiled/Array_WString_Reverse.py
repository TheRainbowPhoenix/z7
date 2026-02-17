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


def Array_WString_Search(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Int
    # VAR_INPUT:
    #   array: Array[*] of WString
    #   search_term: WString
    # VAR_TEMP:
    #   _i: Int
    #   _length: Int
    context['_length'] = (UDINT_TO_INT(Array_Any_Length(context['array'])) - 1)
    for _loop_var_1 in range(int(0), int(context['_length']) + 1):
        context['_i'] = _loop_var_1
        if (context['array'][int(context['_i'])] == context['search_term']):
            context['Array.WString.Search'] = context['_i']
            return
    context['Array.WString.Search'] = context['NULL_TOKEN']
    return


def Array_WString_Reverse(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   null_token: WString
    # VAR_IN_OUT:
    #   wstring_array: Array[*] of WString
    # VAR_TEMP:
    #   _has_data_count: Int
    #   _i: Int
    #   _p_swap: Int
    #   _temp: WString
    # VAR CONSTANT:
    #   NOT_FOUND: Int
    context['NOT_FOUND'] = (-1)
    context['_has_data_count'] = Array_WString_Search(array=context['wstring_array'], search_term=context['null_token'])
    if (context['_has_data_count'] == 0):
        return
    if (context['_has_data_count'] == context['NOT_FOUND']):
        context['_has_data_count'] = UDINT_TO_INT(Array_Any_Length(context['wstring_array']))
    context['_has_data_count'] = (context['_has_data_count'] - 1)
    for _loop_var_1 in range(int(0), int((context['_has_data_count'] / 2)) + 1):
        context['_i'] = _loop_var_1
        context['_p_swap'] = (context['_has_data_count'] - context['_i'])
        context['_temp'] = context['wstring_array'][int(context['_i'])]
        context['wstring_array'][int(context['_i'])] = context['wstring_array'][int(context['_p_swap'])]
        context['wstring_array'][int(context['_p_swap'])] = context['_temp']
    return
