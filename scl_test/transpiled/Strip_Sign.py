import math

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
