import math

def Char_Is_Numeric(context, global_dbs):
    # Return Type: Bool
    # VAR_INPUT:
    #   character: Char
    # VAR CONSTANT:
    #   NUMBERS: String
    context['NUMBERS'] = '0123456789'
    if (FIND(IN1=context['NUMBERS'], IN2=CHAR_TO_STRING(context['character'])) == 0):
        context['Char.Is_Numeric'] = False
        return
    context['Char.Is_Numeric'] = True
    return
