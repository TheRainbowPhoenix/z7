import math

def String_Trim(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
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
    context['String.Trim'] = context['ret']


def String_Strip_Sign(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
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
    if ((context['Test Character'] == context['+']) or (context['Test Character'] == context['-'])):
        context['Length'] = LEN(context['String Box'])
        context['String Box'] = RIGHT_STRING(IN=context['String Box'], L=(context['Length'] - 1))
    context['String.Strip Sign'] = context['String Box']


def Nibble_To_String(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: String
    # VAR_INPUT:
    #   value: Byte
    # VAR_TEMP:
    #   _nibble_as_int: Int
    #   _ret: String
    context['_nibble_as_int'] = BYTE_TO_INT(context['value'])
    _case_val_1 = context['_nibble_as_int']
    if (_case_val_1 >= 0 and _case_val_1 <= 9):
        context['_ret'] = String_Trim(String_Strip_Sign(INT_TO_STRING(context['_nibble_as_int'])))
    elif _case_val_1 == 10:
        context['_ret'] = 'A'
    elif _case_val_1 == 11:
        context['_ret'] = 'B'
    elif _case_val_1 == 12:
        context['_ret'] = 'C'
    elif _case_val_1 == 13:
        context['_ret'] = 'D'
    elif _case_val_1 == 14:
        context['_ret'] = 'E'
    elif _case_val_1 == 15:
        context['_ret'] = 'F'
    context['Nibble.ToString'] = context['_ret']
