#include<bits/stdc++.h>
using namespace std;
int main()
{
    int i;
    string str="acd",s;
    cout<<str<<endl;
    char c;
     cin>>c;
     for(i=0;i<str.size();i++)
     {
        if(str[i]>c)
        {
            s=str.insert(i,1,c);
        }
     }
     cout<<s<<endl;
     
}

 