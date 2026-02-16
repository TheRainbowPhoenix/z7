import math

def ADP_Encode_Horizontal_Alignment(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   horizontal_alignment: String
    #   decoded: ADP: Decoded: Horizontal Alignment
    #   encoded: ADP: Encoded: Formatting: Horizontal Alignment
    # VAR_TEMP:
    #   _return: String
    if (context['horizontal_alignment'] == context['decoded'].center):
        context['_return'] = context['encoded'].center
        # GOTO RTRN (Not supported)
    if (context['horizontal_alignment'] == context['decoded'].left):
        context['_return'] = context['encoded'].left
        # GOTO RTRN (Not supported)
    if (context['horizontal_alignment'] == context['decoded'].right):
        context['_return'] = context['encoded'].right
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Encode: Horizontal Alignment'] = context['_return']
