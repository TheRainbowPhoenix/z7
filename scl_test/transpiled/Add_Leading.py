import math

def Add_Leading(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   Leading Character: Char
    #   Desired Length: USInt
    #   String: String
    # VAR_TEMP:
    #   Length: Int
    #   String Box: String
    context['String Box'] = context['String']
    context['Length'] = LEN(context['String Box'])
    while (context['Length'] < context['Desired Length']):
        context['String Box'] = CONCAT_STRING(IN1=context['Leading Character'], IN2=context['String Box'])
        context['Length'] = LEN(context['String Box'])
    context['Add Leading'] = context['String Box']
